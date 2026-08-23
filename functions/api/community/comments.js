import { json, sha256Hex } from '../../_utils.js';

const MAX_NICK = 24;
const MAX_COMMENT = 1200;

async function ensureTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL CHECK(media_type IN ('video','screenshot')),
    content_id TEXT NOT NULL,
    parent_id INTEGER,
    nickname TEXT NOT NULL,
    body TEXT NOT NULL,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_media ON community_comments(media_type,content_id,created_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON community_comments(parent_id)`).run();
}

function normalizeNick(value=''){
  return String(value).trim().replace(/\s+/g,' ').slice(0,MAX_NICK);
}
function nickKey(value=''){
  return String(value).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t')
    .replace(/[^a-z0-9]/g,'');
}
function reservedNick(value=''){
  const n=nickKey(value);
  if(!n) return true;
  if(n.includes('admin') || n.includes('administrator')) return true;
  if(n.startsWith('sixworld') || n.includes('rockstargames')) return true;
  return new Set(['mod','moderator','staff','support','official','owner','root','webmaster','system']).has(n);
}
function validMedia(type,id){
  return ['video','screenshot'].includes(type) && /^[a-zA-Z0-9_.:-]{1,100}$/.test(String(id||''));
}

export async function onRequestGet({request,env}){
  try{
    await ensureTables(env);
    const url=new URL(request.url);
    const mediaType=url.searchParams.get('type')||'';
    const contentId=url.searchParams.get('id')||'';
    if(!validMedia(mediaType,contentId)) return json({error:'invalid media'},400);
    const {results=[]}=await env.DB.prepare(`SELECT id,media_type,content_id,parent_id,nickname,body,created_at
      FROM community_comments WHERE media_type=? AND content_id=? ORDER BY datetime(created_at) ASC, id ASC LIMIT 500`)
      .bind(mediaType,contentId).all();
    return json({items:results});
  }catch(e){
    console.error('comments GET failed',e);
    return json({error:'comments unavailable'},500);
  }
}

export async function onRequestPost({request,env}){
  try{
    await ensureTables(env);
    const payload=await request.json().catch(()=>null);
    const mediaType=String(payload?.mediaType||'');
    const contentId=String(payload?.contentId||'');
    const nickname=normalizeNick(payload?.nickname||'');
    const body=String(payload?.body||'').trim().slice(0,MAX_COMMENT);
    const parentId=payload?.parentId==null?null:Number(payload.parentId);
    if(!validMedia(mediaType,contentId)) return json({error:'invalid media'},400);
    if(nickname.length<2 || nickname.length>MAX_NICK) return json({error:'nickname must be 2-24 characters'},400);
    if(reservedNick(nickname)) return json({error:'nickname is reserved'},400);
    if(body.length<1) return json({error:'comment is empty'},400);

    if(parentId!=null){
      if(!Number.isInteger(parentId) || parentId<1) return json({error:'invalid parent'},400);
      const parent=await env.DB.prepare(`SELECT id FROM community_comments WHERE id=? AND media_type=? AND content_id=?`).bind(parentId,mediaType,contentId).first();
      if(!parent) return json({error:'parent comment not found'},400);
    }

    const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unknown';
    const salt=env.COMMENT_SALT || env.ADMIN_SESSION_SECRET || 'sixworld-comments';
    const ipHash=await sha256Hex(`${salt}:${ip}`);
    const recent=await env.DB.prepare(`SELECT COUNT(*) AS n FROM community_comments WHERE ip_hash=? AND datetime(created_at)>=datetime('now','-1 minute')`).bind(ipHash).first();
    if(Number(recent?.n||0)>=6) return json({error:'too many comments, try again shortly'},429);

    const inserted=await env.DB.prepare(`INSERT INTO community_comments(media_type,content_id,parent_id,nickname,body,ip_hash,created_at)
      VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id,media_type,content_id,parent_id,nickname,body,created_at`)
      .bind(mediaType,contentId,parentId,nickname,body,ipHash).first();
    return json({ok:true,item:inserted},201);
  }catch(e){
    console.error('comments POST failed',e);
    return json({error:'comment could not be posted'},500);
  }
}
