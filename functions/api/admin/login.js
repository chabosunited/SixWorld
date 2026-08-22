import { json, makeSession, sha256Hex } from '../../_utils.js';
export async function onRequestPost({request,env}){
  const {username,password}=await request.json().catch(()=>({}));
  if(username!==(env.ADMIN_USERNAME||'admin'))return json({ok:false},401);
  const expected=env.ADMIN_PASSWORD_HASH || (env.ADMIN_PASSWORD?await sha256Hex(env.ADMIN_PASSWORD):'');
  if(!expected || await sha256Hex(password||'')!==expected)return json({ok:false},401);
  const secret=env.ADMIN_SESSION_SECRET;if(!secret)return json({error:'ADMIN_SESSION_SECRET missing'},500);
  const token=await makeSession(secret);
  return json({ok:true},200,{'set-cookie':`sw_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`});
}
