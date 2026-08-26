import { json, validSession } from '../../_utils.js';

async function isAuthorized(request, env){
  return validSession(env.ADMIN_SESSION_SECRET || '', request.headers.get('cookie') || '');
}

function githubConfig(env){
  return {
    token: String(env.GITHUB_TOKEN || '').trim(),
    repo: String(env.GITHUB_REPO || 'chabosunited/SixWorld').trim(),
    branch: String(env.GITHUB_BRANCH || 'main').trim(),
    path: String(env.GITHUB_CONTENT_PATH || 'data/content.json').replace(/^\/+/,'').trim()
  };
}

function githubHeaders(token){
  return {
    'accept':'application/vnd.github+json',
    'authorization':`Bearer ${token}`,
    'x-github-api-version':'2022-11-28',
    'user-agent':'SIXWORLD-Admin-Backup'
  };
}

function bytesToBase64(text){
  const bytes=new TextEncoder().encode(text);
  let binary='';
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(binary);
}

function base64ToText(value=''){
  try{
    const binary=atob(String(value).replace(/\s+/g,''));
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch(e){ return ''; }
}

async function getGithubFile(cfg){
  const url=`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`;
  const r=await fetch(url,{headers:githubHeaders(cfg.token)});
  if(r.status===404) return {exists:false,sha:null,content:'',url};
  const payload=await r.json().catch(()=>null);
  if(!r.ok) throw new Error(payload?.message || `GitHub GET HTTP ${r.status}`);
  return {
    exists:true,
    sha:payload?.sha||null,
    content:payload?.content?base64ToText(payload.content):'',
    html_url:payload?.html_url||'',
    url
  };
}

async function currentD1Content(env){
  const row=await env.DB.prepare('SELECT json, updated_at FROM site_content WHERE id=1').first();
  if(!row?.json) throw new Error('No D1 site_content document found.');
  const parsed=JSON.parse(row.json);
  return {
    content:parsed,
    text:JSON.stringify(parsed,null,2)+'\n',
    updated_at:row.updated_at||null
  };
}

export async function onRequestGet({request,env}){
  if(!await isAuthorized(request,env)) return json({error:'unauthorized'},401);
  const cfg=githubConfig(env);
  if(!cfg.token){
    return json({
      ok:true,
      configured:false,
      repo:cfg.repo,
      branch:cfg.branch,
      path:cfg.path
    });
  }
  try{
    const remote=await getGithubFile(cfg);
    return json({
      ok:true,
      configured:true,
      repo:cfg.repo,
      branch:cfg.branch,
      path:cfg.path,
      exists:remote.exists,
      html_url:remote.html_url||null
    });
  }catch(e){
    return json({
      ok:false,
      configured:true,
      error:String(e?.message||e),
      repo:cfg.repo,
      branch:cfg.branch,
      path:cfg.path
    },502);
  }
}

export async function onRequestPost({request,env}){
  if(!await isAuthorized(request,env)) return json({error:'unauthorized'},401);

  const cfg=githubConfig(env);
  if(!cfg.token){
    return json({
      error:'github backup not configured',
      hint:'Add GITHUB_TOKEN as a Cloudflare secret.'
    },503);
  }

  try{
    const local=await currentD1Content(env);
    const remote=await getGithubFile(cfg);

    // Do not create pointless commits when the repo already has this exact content.
    if(remote.exists && remote.content.replace(/\r\n/g,'\n')===local.text.replace(/\r\n/g,'\n')){
      return json({
        ok:true,
        skipped:true,
        message:'GitHub backup already up to date.',
        repo:cfg.repo,
        branch:cfg.branch,
        path:cfg.path,
        updated_at:local.updated_at,
        html_url:remote.html_url||null
      });
    }

    const url=`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`;
    const now=new Date().toISOString().replace('T',' ').replace(/\.\d{3}Z$/,' UTC');
    const body={
      message:`SIXWORLD content backup · ${now}`,
      content:bytesToBase64(local.text),
      branch:cfg.branch
    };
    if(remote.sha) body.sha=remote.sha;

    const r=await fetch(url,{
      method:'PUT',
      headers:{...githubHeaders(cfg.token),'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    const payload=await r.json().catch(()=>null);
    if(!r.ok) throw new Error(payload?.message || `GitHub PUT HTTP ${r.status}`);

    return json({
      ok:true,
      skipped:false,
      message:'GitHub backup updated.',
      repo:cfg.repo,
      branch:cfg.branch,
      path:cfg.path,
      updated_at:local.updated_at,
      commit_sha:payload?.commit?.sha||null,
      commit_url:payload?.commit?.html_url||null,
      html_url:payload?.content?.html_url||null
    });
  }catch(e){
    console.error('SIXWORLD GitHub backup failed',e);
    return json({error:'github backup failed',detail:String(e?.message||e)},502);
  }
}
