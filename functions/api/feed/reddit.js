import { json } from '../../_utils.js';
export async function onRequestGet({request}){
  const u=new URL(request.url);const subreddit=(u.searchParams.get('subreddit')||'GTA6').replace(/[^a-z0-9_]/gi,'');
  const r=await fetch(`https://www.reddit.com/r/${subreddit}/new.json?limit=12`,{headers:{'user-agent':'SIXWORLD/1.0 GTA6 fan news aggregator'}});if(!r.ok)return json({error:'reddit unavailable'},502);
  const d=await r.json();const items=(d.data?.children||[]).map(x=>x.data).filter(Boolean).map(x=>({id:`reddit_${x.id}`,title:x.title,date:new Date(x.created_utc*1000).toISOString(),source:'REDDIT',image:x.thumbnail?.startsWith('http')?x.thumbnail:'assets/GTA6MapSideview.png',summary:`r/${x.subreddit} · ${x.score} points · ${x.num_comments} comments`,url:`https://www.reddit.com${x.permalink}`}));return json({items});
}
