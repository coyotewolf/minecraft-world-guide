export function accountStorage(projectUrl,local=localStorage,tab=sessionStorage){
 const project=new URL(projectUrl).hostname.split('.')[0],key='sb-'+project+'-auth-token';
 try{const previous=local.getItem(key);if(previous&&!tab.getItem(key)&&previous.length<64000){const value=JSON.parse(previous);if(typeof value.access_token==='string'&&typeof value.refresh_token==='string')tab.setItem(key,previous);}local.removeItem(key);local.removeItem(key+'-code-verifier');}catch{throw Error('此瀏覽器無法安全保存登入，請允許分頁儲存後重試。');}
 return {getItem:k=>tab.getItem(k),setItem:(k,v)=>tab.setItem(k,v),removeItem:k=>tab.removeItem(k)};
}
