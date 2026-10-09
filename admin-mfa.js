export async function openAdminMfa({db,h,modal,closeModal,onVerified,onError}){
 let enrolled=null,submitted=false,closed=false;const dialog=document.querySelector('#modal');
 const cleanup=()=>{closed=true;if(enrolled&&!submitted)void db.auth.mfa.unenroll({factorId:enrolled}).catch(()=>{});};
 dialog.addEventListener('close',cleanup,{once:true});
 try{
  const listed=await db.auth.mfa.listFactors();if(listed.error)throw listed.error;
  let factor=listed.data.totp.find(f=>f.status==='verified'),qr='',secret='';
  if(!factor){
   // Remove only abandoned, unverified AOI setup factors from this account.
   for(const old of listed.data.totp.filter(f=>f.status==='unverified'&&f.friendly_name==='AOI 管理員')){const removed=await db.auth.mfa.unenroll({factorId:old.id});if(removed.error)throw removed.error;}
   const result=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'AOI 管理員',issuer:'AOI'});if(result.error)throw result.error;
   enrolled=result.data.id;factor=result.data;secret=result.data.totp.secret;qr=result.data.totp.qr_code;
   if(closed){await db.auth.mfa.unenroll({factorId:enrolled});return;}
   if(qr.startsWith('<svg'))qr='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr);
   if(!qr.startsWith('data:image/svg+xml'))throw Error('驗證 QR 圖碼格式異常');
  }
  modal('管理員二步驟驗證',`<form id="admin-mfa-form" class="form-grid">${enrolled?`<p>請用驗證器 App 掃描圖碼，保存設定後輸入六位驗證碼。</p><img class="mfa-qr" src="${h(qr)}" alt="管理員驗證器設定圖碼" width="200" height="200"><details><summary>手動設定金鑰</summary><p class="secret">${h(secret)}</p></details><p>設定金鑰只顯示在這裡，請保存於自己的驗證器。勿分享或貼進聊天。</p>`:'<p>請輸入你的驗證器目前顯示的六位驗證碼。</p>'}<label>驗證碼<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><p id="admin-mfa-error" role="alert"></p><button class="primary" type="submit">驗證並開啟管理員控制檯</button></form>`);
  const form=document.querySelector('#admin-mfa-form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;const input=form.querySelector('input');const code=input.value.trim();input.value='';try{if(!/^[0-9]{6}$/.test(code))throw Error('請輸入六位數字');const result=await db.auth.mfa.challengeAndVerify({factorId:factor.id,code});if(result.error)throw result.error;submitted=true;await onVerified();closeModal();}catch{document.querySelector('#admin-mfa-error').textContent='驗證碼不正確或已過期，請重試。';}finally{button.disabled=false;}};
 }catch{dialog.removeEventListener('close',cleanup);cleanup();onError(Error('無法開啟二步驟驗證，請稍後重試。'));}
}
