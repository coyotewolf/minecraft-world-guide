export class RequestError extends Error { constructor(status,message){super(message);this.status=status;} }
export async function boundedText(request,limit=4096,timeoutMs=5000){
 const declared=request.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))throw new RequestError(413,'資料過長');
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];let size=0,timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new RequestError(408,'讀取資料逾時')),timeoutMs);});
 try{while(true){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;size+=value.byteLength;if(size>limit)throw new RequestError(413,'資料過長');chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
export async function boundedJson(request){try{const value=JSON.parse(await boundedText(request));if(!value||typeof value!=='object'||Array.isArray(value))throw new RequestError(400,'資料格式不正確');return value;}catch(e){if(e instanceof RequestError)throw e;throw new RequestError(400,'資料格式不正確');}}
export function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length||a.length>256)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function safeNewPassword(password,fetcher=fetch){
 // SHA-1 is used only for the public breach corpus lookup, never password storage.
 const bytes=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(password));const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
 let text;try{const response=await fetcher('https://api.pwnedpasswords.com/range/'+digest.slice(0,5),{headers:{'Add-Padding':'true','User-Agent':'AOI-password-security'},signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error();text=await boundedText(response,200000,4000);}catch{throw new RequestError(503,'目前無法檢查密碼安全性，請稍後再試');}
 const lines=text.trim().split(/\r?\n/);if(!lines.length||lines.some(line=>!/^([0-9A-F]{35}):\d+$/i.test(line)))throw new RequestError(503,'密碼安全檢查暫時無法使用');
 if(lines.some(line=>{const [suffix,count]=line.split(':');return suffix.toUpperCase()===digest.slice(5)&&Number(count)>0;}))throw new RequestError(400,'這組密碼曾出現在外洩資料，請換一組網站專用密碼');
}
