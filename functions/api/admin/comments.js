import { json, validSession } from '../../_utils.js';

async function authorized(request,env){
  return validSession(env.ADMIN_SESSION_SECRET||'',request.headers.get('cookie')||'');
}
async function ensureTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    parent_id INTEGER,
    nickname TEXT NOT NULL,
    body TEXT NOT NULL,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function onRequestGet({request,env}){
  if(!await authorized(request,env)) return json({error:'unauthorized'},401);
  try{
    await ensureTable(env);
    const {results=[]}=await env.DB.prepare(`SELECT id,media_type,content_id,parent_id,nickname,body,created_at
      FROM community_comments ORDER BY datetime(created_at) DESC,id DESC LIMIT 500`).all();
    return json({items:results});
  }catch(e){return json({error:'comments unavailable'},500);}
}

export async function onRequestDelete({request,env}){
  if(!await authorized(request,env)) return json({error:'unauthorized'},401);
  try{
    await ensureTable(env);
    const url=new URL(request.url);
    const id=Number(url.searchParams.get('id'));
    if(!Number.isInteger(id)||id<1) return json({error:'invalid comment id'},400);
    await env.DB.prepare(`WITH RECURSIVE descendants(id) AS (
      SELECT id FROM community_comments WHERE id=?
      UNION ALL
      SELECT c.id FROM community_comments c JOIN descendants d ON c.parent_id=d.id
    ) DELETE FROM community_comments WHERE id IN (SELECT id FROM descendants)`).bind(id).run();
    return json({ok:true});
  }catch(e){
    console.error('admin comment delete failed',e);
    return json({error:'delete failed'},500);
  }
}
