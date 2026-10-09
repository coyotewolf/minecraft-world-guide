export async function readAccountBootstrap(db,userId){
 const result=await db.rpc('account_bootstrap');if(result.error)throw Error(result.error.message||'帳號資料無法讀取');
 const value=result.data;if(!value||typeof value.status?.active!=='boolean')throw Error('帳號資料格式不正確');
 if(value.status.active){if(value.profile?.id!==userId||value.world?.user_id!==userId||!Array.isArray(value.progress)||!Array.isArray(value.teams)||value.progress.some(p=>p.user_id!==userId||p.world_id!==value.world.id))throw Error('帳號資料歸屬不正確');}
 return value;
}
