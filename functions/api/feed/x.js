import { json } from '../../_utils.js';
export async function onRequestGet({request,env}){
  if(!env.X_BEARER_TOKEN)return json({error:'X_BEARER_TOKEN missing'},501);
  const username=new URL(request.url).searchParams.get('user')||'RockstarGames';const h={Authorization:`Bearer ${env.X_BEARER_TOKEN}`};
  const ur=await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`,{headers:h});if(!ur.ok)return json({error:'x user lookup failed'},502);const user=await ur.json();
  const tr=await fetch(`https://api.x.com/2/users/${user.data.id}/tweets?max_results=10&tweet.fields=created_at,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url`,{headers:h});if(!tr.ok)return json({error:'x feed failed'},502);const d=await tr.json();const media=Object.fromEntries((d.includes?.media||[]).map(m=>[m.media_key,m.url||m.preview_image_url]));
  return json({items:(d.data||[]).map(t=>({id:`x_${t.id}`,title:t.text,date:t.created_at,source:'X',image:media[t.attachments?.media_keys?.[0]]||'assets/news-default.png',summary:'Rockstar Games on X',url:`https://x.com/${username}/status/${t.id}`}))});
}
