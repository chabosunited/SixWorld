import { json, validSession } from '../../_utils.js';

async function isAuthorized(request, env){
  return validSession(env.ADMIN_SESSION_SECRET || '', request.headers.get('cookie') || '');
}

export async function onRequestGet({request,env}){
  if(!await isAuthorized(request, env)) return json({error:'unauthorized'},401);
  try{
    const row = await env.DB.prepare('SELECT json, updated_at FROM site_content WHERE id=1').first();
    if(!row?.json) return json({error:'not found'},404);
    return new Response(row.json,{headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-updated-at':row.updated_at||''}});
  }catch(e){
    return json({error:'database read failed'},500);
  }
}

export async function onRequestPut({request,env}){
  if(!await isAuthorized(request, env)) return json({error:'unauthorized'},401);
  const body = await request.json().catch(()=>null);
  if(!body || !Array.isArray(body.hero) || !Array.isArray(body.leaks) || !Array.isArray(body.screenshots) || !Array.isArray(body.news) || !body.map) {
    return json({error:'invalid content'},400);
  }
  const text = JSON.stringify(body);
  await env.DB.prepare(`INSERT INTO site_content(id,json,updated_at) VALUES(1,?,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=CURRENT_TIMESTAMP`).bind(text).run();
  return json({ok:true});
}
