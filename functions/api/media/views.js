import { json } from '../../_utils.js';

async function ensureTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS media_views (
    media_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(media_type,content_id)
  )`).run();
}
function validMedia(type,id){return ['video','screenshot'].includes(type)&&/^[a-zA-Z0-9_.:-]{1,100}$/.test(String(id||''));}
function streamableCode(raw=''){
  try{
    const u=new URL(raw);
    if(!/(^|\.)streamable\.com$/i.test(u.hostname)) return '';
    const parts=u.pathname.split('/').filter(Boolean);
    if(parts[0]==='e'||parts[0]==='s') return parts[1]||'';
    return parts[0]||'';
  }catch(e){return '';}
}
async function streamableViews(raw){
  const code=streamableCode(raw); if(!code) return null;
  try{
    const cacheKey=new Request(`https://sixworld.local/streamable-views/${encodeURIComponent(code)}`);
    const cached=await caches.default.match(cacheKey);
    if(cached){const d=await cached.json();return Number.isFinite(+d.views)?+d.views:null;}
    const r=await fetch(`https://streamable.com/${encodeURIComponent(code)}`,{headers:{'User-Agent':'Mozilla/5.0 SIXWORLD/1.0','Accept':'text/html'}});
    if(!r.ok) return null;
    const html=await r.text();
    const matches=[...html.matchAll(/([\d][\d,.\s]*)\s+views?\b/gi)];
    if(!matches.length) return null;
    const value=Number(matches[0][1].replace(/[^0-9]/g,''));
    if(!Number.isFinite(value)) return null;
    const response=new Response(JSON.stringify({views:value}),{headers:{'content-type':'application/json','cache-control':'public,max-age=60'}});
    try{await caches.default.put(cacheKey,response.clone());}catch(_){}
    return value;
  }catch(e){return null;}
}

export async function onRequestGet({request,env}){
  try{
    await ensureTable(env);
    const url=new URL(request.url);
    const type=url.searchParams.get('type')||'video';
    const id=url.searchParams.get('id')||'';
    const sourceUrl=url.searchParams.get('url')||'';
    if(!validMedia(type,id)) return json({error:'invalid media'},400);
    if(type==='video'&&sourceUrl){
      const external=await streamableViews(sourceUrl);
      if(external!=null) return json({views:external,source:'streamable'});
    }
    const row=await env.DB.prepare(`SELECT views FROM media_views WHERE media_type=? AND content_id=?`).bind(type,id).first();
    return json({views:Number(row?.views||0),source:'sixworld'});
  }catch(e){return json({views:0,source:'sixworld'},200);}
}

export async function onRequestPost({request,env}){
  try{
    await ensureTable(env);
    const p=await request.json().catch(()=>null);
    const type=String(p?.mediaType||'');
    const id=String(p?.contentId||'');
    if(!validMedia(type,id)) return json({error:'invalid media'},400);
    await env.DB.prepare(`INSERT INTO media_views(media_type,content_id,views,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)
      ON CONFLICT(media_type,content_id) DO UPDATE SET views=views+1,updated_at=CURRENT_TIMESTAMP`).bind(type,id).run();
    const row=await env.DB.prepare(`SELECT views FROM media_views WHERE media_type=? AND content_id=?`).bind(type,id).first();
    return json({ok:true,views:Number(row?.views||0),source:'sixworld'});
  }catch(e){return json({error:'view count unavailable'},500);}
}
