import { json } from '../_utils.js';

export async function onRequestGet({env}){
  try{
    const row = await env.DB.prepare('SELECT json, updated_at FROM site_content WHERE id=1').first();
    if(row?.json){
      return new Response(row.json,{headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-updated-at':row.updated_at||''}});
    }
  }catch(e){}
  return json({error:'no database content yet'},404);
}
