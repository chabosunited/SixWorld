import { json } from '../_utils.js';

async function ensureStats(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    visitors INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`INSERT INTO site_stats(id,visitors,hits,updated_at)
    VALUES(1,0,0,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO NOTHING`).run();
}

function hasVisitorCookie(cookie=''){
  return /(?:^|;\s*)sw_visitor=1(?:;|$)/.test(cookie);
}

async function readStats(env){
  return env.DB.prepare('SELECT visitors,hits,updated_at FROM site_stats WHERE id=1').first();
}

export async function onRequestGet({request,env}){
  try{
    await ensureStats(env);
    const cookie=request.headers.get('cookie')||'';
    let setCookie='';
    if(!hasVisitorCookie(cookie)){
      await env.DB.prepare(`UPDATE site_stats SET visitors=visitors+1, updated_at=CURRENT_TIMESTAMP WHERE id=1`).run();
      setCookie='sw_visitor=1; Secure; SameSite=Lax; Path=/; Max-Age=31536000';
    }
    const row=await readStats(env);
    return json({visitors:row?.visitors||0,hits:row?.hits||0,updated_at:row?.updated_at||null},200,setCookie?{'set-cookie':setCookie}:{});
  }catch(e){
    return json({error:'stats unavailable'},500);
  }
}

export async function onRequestPost({env}){
  try{
    let result;
    try{
      result=await env.DB.prepare(`UPDATE site_stats SET hits=hits+1, updated_at=CURRENT_TIMESTAMP WHERE id=1`).run();
    }catch(e){
      await ensureStats(env);
      result=await env.DB.prepare(`UPDATE site_stats SET hits=hits+1, updated_at=CURRENT_TIMESTAMP WHERE id=1`).run();
    }
    if(!result?.success){
      await ensureStats(env);
      await env.DB.prepare(`UPDATE site_stats SET hits=hits+1, updated_at=CURRENT_TIMESTAMP WHERE id=1`).run();
    }
    const row=await readStats(env);
    return json({visitors:row?.visitors||0,hits:row?.hits||0,updated_at:row?.updated_at||null});
  }catch(e){
    return json({error:'stats unavailable'},500);
  }
}
