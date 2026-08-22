const enc = new TextEncoder();
export async function sha256Hex(s){const d=await crypto.subtle.digest('SHA-256',enc.encode(s));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hmac(secret,msg){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',k,enc.encode(msg));return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/,'')}
export async function makeSession(secret){const exp=Date.now()+1000*60*60*12;const body=`admin.${exp}`;return `${body}.${await hmac(secret,body)}`}
export async function validSession(secret,cookie=''){const m=cookie.match(/(?:^|;\s*)sw_session=([^;]+)/);if(!m)return false;const [role,exp,sig]=decodeURIComponent(m[1]).split('.');if(role!=='admin'||!exp||Date.now()>+exp)return false;return sig===await hmac(secret,`${role}.${exp}`)}
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}})
