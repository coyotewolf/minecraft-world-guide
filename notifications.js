export const notificationSupported=()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
export async function enableTeamNotifications(db,cfg){
 if(!notificationSupported())throw Error('此瀏覽器不支援推播。iPhone／iPad 請先將網站加入主畫面，再從主畫面開啟。');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error(permission==='denied'?'通知已被封鎖，請到瀏覽器的網站設定開啟通知。':'尚未允許通知。');
 const {data,error}=await db.functions.invoke('team-push',{body:{action:'config'}});if(error)throw Error('通知服務暫時無法連線');
 const registration=await navigator.serviceWorker.register('notification-worker.js',{scope:'./'});await navigator.serviceWorker.ready;
 const raw=atob(data.publicKey.replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 const result=await db.rpc('save_push_subscription',{s:subscription.toJSON()});if(result.error)throw result.error;
 localStorage.setItem('aoi-notifications','enabled');
}
export async function disableTeamNotifications(db){const r=await navigator.serviceWorker?.getRegistration('./'),s=await r?.pushManager.getSubscription();if(s){const result=await db.rpc('remove_push_subscription',{e:s.endpoint});if(result.error)throw result.error;await s.unsubscribe()}localStorage.removeItem('aoi-notifications');}
