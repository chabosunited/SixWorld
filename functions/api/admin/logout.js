import { json } from '../../_utils.js';
export async function onRequestPost(){return json({ok:true},200,{'set-cookie':'sw_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'})}
