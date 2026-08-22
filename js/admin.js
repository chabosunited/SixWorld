(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
  const clone=o=>JSON.parse(JSON.stringify(o));

  let tab='dashboard', draft=null;
  let editIds={hero:null, leaks:null, screens:null, news:null};
  let selectedBlipId=null;

  const titles={
    dashboard:'Overview', hero:'Hero Slides', leaks:'Leaks / Videos', screens:'Screenshots',
    news:'News', map:'Interactive Map', settings:'Settings', access:'Access'
  };

  $('#adminTrigger').addEventListener('click',()=>window.SIXWORLD.openModal('loginModal'));
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const username=$('#adminUser').value.trim();
    const password=$('#adminPass').value;
    let ok=false;
    try{
      const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
      if(r.ok){window.SIXWORLD.backend=true; ok=true;}
    }catch(e){}
    const access = window.SIXWORLD.content?.access || {};
    if(!ok && !window.SIXWORLD.backend && username===(access.demoUser||'admin') && password===(access.demoPass||'sixworld')){
      ok=true; localStorage.setItem('sixworld_demo_auth','1');
    }
    if(ok){ window.SIXWORLD.closeModal('loginModal'); openAdmin(); }
    else { $('#loginHint').textContent=`Login failed. Local preview: ${(access.demoUser||'admin')} / ${(access.demoPass||'sixworld')}`; $('#adminPass').value=''; }
  });

  $('#closeAdmin').onclick=closeAdmin;
  $('#logoutBtn').onclick=logout;
  $('#saveAdmin').onclick=saveDraft;
  $$('.admin-nav [data-admin-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.adminTab; renderTab(); });

  function openAdmin(){
    draft=clone(window.SIXWORLD.content);
    normalizeDraft();
    $('#adminOverlay').classList.add('open');
    $('#adminOverlay').setAttribute('aria-hidden','false');
    $('#adminMode').textContent=window.SIXWORLD.backend?'MODE: CLOUDFLARE API':'MODE: LOCAL PREVIEW';
    renderTab();
  }
  function closeAdmin(){ $('#adminOverlay').classList.remove('open'); $('#adminOverlay').setAttribute('aria-hidden','true'); }
  async function logout(){ try{await fetch('/api/admin/logout',{method:'POST'})}catch(e){} localStorage.removeItem('sixworld_demo_auth'); closeAdmin(); }

  function normalizeDraft(){
    draft.hero ||= []; draft.leaks ||= []; draft.screenshots ||= []; draft.news ||= [];
    draft.map ||= {image:'assets/InteractiveMap/GTA6MAP.png', blips:[]};
    draft.map.blips ||= [];
    draft.map.categories ||= [
      {key:'all',label:'ALL',legend:'ALL LOCATIONS',short:'ALL'},
      {key:'city',label:'CITY',legend:'CITY / AREA',short:'CTY'},
      {key:'poi',label:'POI',legend:'POINT OF INTEREST',short:'POI'},
      {key:'leak',label:'LEAK',legend:'LEAK / RUMOR',short:'LEK'}
    ];
    draft.settings ||= {siteName:'SIXWORLD',searchPlaceholder:'Search...',accent:'#ff4fa3',accent2:'#42e6ee'};
    draft.feeds ||= {enabled:true, subreddit:'GTA6', xUser:'RockstarGames', maxItems:6};
    draft.access ||= {secretText:'sw_6.0.22',secretPage:'map',demoUser:'admin',demoPass:'sixworld'};
  }

  async function saveDraft(){
    normalizeDraft();
    let saved=false;
    if(window.SIXWORLD.backend){
      try{
        const r=await fetch('/api/admin/content',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(draft)});
        saved=r.ok;
      }catch(e){}
    }
    if(!saved){
      localStorage.setItem(window.SIXWORLD.FALLBACK_KEY,JSON.stringify(draft));
      saved=true;
    }
    window.SIXWORLD.content=clone(draft);
    window.SIXWORLD.renderAll();
    window.SIXWORLD.toast(saved?'Changes saved.':'Save failed.');
  }

  function stat(n,l){ return `<div class="stat-card"><b>${n}</b><span>${l}</span></div>`; }
  function adminRow(img,title,sub,arr,id){
    return `<div class="admin-row" data-edit="${id}" data-array="${arr}">
      <img src="${img||'assets/logo/sixworldlogo.png'}" alt="">
      <div><b>${window.SIXWORLD.escapeHtml(title)}</b><small>${window.SIXWORLD.escapeHtml(sub||'')}</small></div>
      <button data-delete="${id}" data-array="${arr}" title="Delete">×</button>
    </div>`;
  }
  function bindDeletes(){
    $$('[data-delete]','#adminContent').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const a=b.dataset.array;
      if(a==='screens') draft.screenshots = draft.screenshots.filter(x=>x.id!==b.dataset.delete);
      else draft[a] = draft[a].filter(x=>x.id!==b.dataset.delete);
      if(editIds[a]===b.dataset.delete) editIds[a]=null;
      renderTab();
    });
  }
  function bindSelects(key, cb){
    $$(`.admin-row[data-array="${key}"]`, '#adminContent').forEach(row=>row.onclick=()=>cb(row.dataset.edit));
  }
  function setTab(next){ tab=next; renderTab(); }

  function renderTab(){
    $$('.admin-nav [data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));
    $('#adminTitle').textContent=titles[tab] || 'Overview';
    ({dashboard:renderDash,hero:renderHero,leaks:renderLeaks,screens:renderScreens,news:renderNews,map:renderMap,settings:renderSettings,access:renderAccess}[tab])();
  }

  function renderDash(){
    $('#adminContent').innerHTML = `
      <div class="admin-cards">
        ${stat(draft.hero.length,'HERO SLIDES')}
        ${stat(draft.leaks.length,'VIDEOS')}
        ${stat(draft.screenshots.length,'SCREENSHOTS')}
        ${stat(draft.map.blips.length,'MAP BLIPS')}
      </div>
      <section class="admin-section"><h3>Content Control Center</h3><p class="inline-note">Verwalte Homepage, Videos, Screenshots, News und die interaktive Map. In Cloudflare/D1 Mode werden die Daten zentral gespeichert, im lokalen Preview direkt im Browser.</p><div class="inline-actions"><button class="ghost-btn" id="dashGoHero">EDIT HERO</button><button class="ghost-btn" id="dashGoMap">EDIT MAP</button><button class="ghost-btn" id="dashGoNews">EDIT NEWS</button></div></section>
      <section class="admin-section"><h3>Current Admin Access</h3><div class="codebox">Hidden trigger text: <b>${window.SIXWORLD.escapeHtml(draft.access.secretText)}</b><br>Visible page: <b>${window.SIXWORLD.escapeHtml(draft.access.secretPage)}</b><br>Local demo login: <b>${window.SIXWORLD.escapeHtml(draft.access.demoUser)}</b> / <b>${window.SIXWORLD.escapeHtml(draft.access.demoPass)}</b></div></section>`;
    $('#dashGoHero').onclick=()=>setTab('hero');
    $('#dashGoMap').onclick=()=>setTab('map');
    $('#dashGoNews').onclick=()=>setTab('news');
  }

  function entityEditor(config){
    const {key,title,list,fields,imgKey,subtitle} = config;
    const editId = editIds[key];
    const current = list.find(x=>x.id===editId) || {};
    const formHtml = fields.map(f=>{
      if(f.type==='textarea') return `<div class="admin-field ${f.full?'full':''}"><label>${f.label}</label><textarea id="${key}_${f.name}">${window.SIXWORLD.escapeHtml(current[f.name]||f.default||'')}</textarea></div>`;
      if(f.type==='select') return `<div class="admin-field ${f.full?'full':''}"><label>${f.label}</label><select id="${key}_${f.name}">${f.options.map(opt=>`<option value="${opt}" ${String(current[f.name]||f.default||'')===String(opt)?'selected':''}>${opt}</option>`).join('')}</select></div>`;
      return `<div class="admin-field ${f.full?'full':''}"><label>${f.label}</label><input id="${key}_${f.name}" ${f.type?`type="${f.type}"`:''} value="${window.SIXWORLD.escapeHtml(current[f.name]||f.default||'')}"></div>`;
    }).join('');
    $('#adminContent').innerHTML = `
      <section class="admin-section"><h3>${title}</h3><div class="admin-list">${list.map(x=>adminRow(x[imgKey],x.title||x.eyebrow||x.label,subtitle(x),key,x.id)).join('')}</div></section>
      <section class="admin-section"><h3>${editId?'Edit Selected':'Create New'}</h3><div class="admin-form">${formHtml}</div><div class="inline-actions"><button class="solid-btn" id="saveEntity">${editId?'UPDATE':'ADD NEW'}</button><button class="ghost-btn" id="newEntity">CLEAR / NEW</button></div></section>`;
    bindDeletes();
    bindSelects(key,id=>{ editIds[key]=id; renderTab(); });
    $('#newEntity').onclick=()=>{ editIds[key]=null; renderTab(); };
    $('#saveEntity').onclick=()=>{
      const values={}; fields.forEach(f=>values[f.name] = $(`#${key}_${f.name}`).value);
      if(editIds[key]){
        const index=list.findIndex(x=>x.id===editIds[key]);
        if(index>-1) list[index] = {...list[index], ...values};
      }else{
        list.unshift({id:uid(key.slice(0,1)), ...values});
      }
      editIds[key]=null; renderTab();
    };
  }

  function renderHero(){
    entityEditor({
      key:'hero', title:'Hero Slides', list:draft.hero, imgKey:'image', subtitle:x=>x.description,
      fields:[
        {name:'eyebrow',label:'EYEBROW / TITLE',default:'WELCOME TO'},
        {name:'cta',label:'BUTTON LABEL',default:'EXPLORE NOW'},
        {name:'href',label:'BUTTON LINK',default:'#news'},
        {name:'image',label:'IMAGE PATH OR URL',default:'assets/gta-6-trailer-2.jpg',full:true},
        {name:'description',label:'DESCRIPTION',type:'textarea',full:true}
      ]
    });
  }

  function renderLeaks(){
    entityEditor({
      key:'leaks', title:'Videos / Leaks', list:draft.leaks, imgKey:'thumb', subtitle:x=>`${x.date||''} · ${x.duration||''} · ${x.source||''}`,
      fields:[
        {name:'title',label:'TITLE'},
        {name:'date',label:'DATE',default:'Aug 22, 2026'},
        {name:'duration',label:'DURATION',default:'02:00'},
        {name:'source',label:'SOURCE',default:'Community'},
        {name:'thumb',label:'THUMBNAIL PATH / URL',default:'assets/gta-6-trailer-2.jpg',full:true},
        {name:'video',label:'VIDEO LINK (Streamable / Drive / YouTube / MP4)',full:true}
      ]
    });
  }

  function renderScreens(){
    entityEditor({
      key:'screens', title:'Screenshot Library', list:draft.screenshots, imgKey:'image', subtitle:x=>x.source||'',
      fields:[
        {name:'title',label:'TITLE'},
        {name:'source',label:'SOURCE',default:'SIXWORLD'},
        {name:'image',label:'IMAGE PATH OR URL',full:true}
      ]
    });
  }

  function renderNews(){
    entityEditor({
      key:'news', title:'News Feed', list:draft.news, imgKey:'image', subtitle:x=>`${x.source||''} · ${x.date||''}`,
      fields:[
        {name:'title',label:'HEADLINE'},
        {name:'source',label:'SOURCE',type:'select',options:['SIXWORLD','ROCKSTAR','X','REDDIT'],default:'SIXWORLD'},
        {name:'date',label:'DATE',default:'Aug 22, 2026'},
        {name:'url',label:'LINK',default:'#news'},
        {name:'image',label:'IMAGE PATH / URL',default:'assets/gta-6-trailer-2.jpg',full:true},
        {name:'summary',label:'SUMMARY',type:'textarea',full:true}
      ]
    });
    const section = document.createElement('section');
    section.className='admin-section';
    section.innerHTML = `<h3>Live Feed Import</h3><p class="inline-note">Importiere aktuelle Items aus Reddit und X direkt in deine manuelle News-Liste.</p><div class="inline-actions"><button class="solid-btn" id="importFeedsBtn">IMPORT LIVE FEEDS</button></div>`;
    $('#adminContent').appendChild(section);
    $('#importFeedsBtn').onclick = async ()=>{
      const subreddit = draft.feeds?.subreddit || 'GTA6';
      const xUser = draft.feeds?.xUser || 'RockstarGames';
      const [reddit, xFeed] = await Promise.all([
        fetch(`/api/feed/reddit?subreddit=${encodeURIComponent(subreddit)}`).then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
        fetch(`/api/feed/x?user=${encodeURIComponent(xUser)}`).then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]}))
      ]);
      const items = [...(xFeed.items||[]), ...(reddit.items||[])];
      const seen = new Set(draft.news.map(x=>x.url || x.id || x.title));
      let added = 0;
      items.forEach(item=>{ const key=item.url||item.id||item.title; if(!key || seen.has(key)) return; seen.add(key); draft.news.unshift(item); added++; });
      window.SIXWORLD.toast(`Imported ${added} live items.`);
      renderNews();
    };
  }

  function renderMap(){
    const blips=draft.map.blips;
    const categories=(draft.map.categories||[]).filter(x=>x.key!=='all').map(x=>x.key);
    const selected = blips.find(x=>x.id===selectedBlipId) || blips[0] || null;
    if(selected && !selectedBlipId) selectedBlipId = selected.id;
    $('#adminContent').innerHTML = `
      <section class="admin-section">
        <h3>Map Setup</h3>
        <div class="admin-form">
          <div class="admin-field full"><label>MAP IMAGE PATH / URL</label><input id="mapImageInput" value="${window.SIXWORLD.escapeHtml(draft.map.image)}"></div>
          <div class="admin-field full"><label>MAP INTRO LABEL</label><input id="mapIntroInput" value="${window.SIXWORLD.escapeHtml(draft.map.introLabel||'VICE CITY & BEYOND')}"></div>
        </div>
        <div class="map-editor-layout" style="margin-top:18px">
          <div>
            <div class="map-editor-preview" id="mapEditPreview"><img src="${window.SIXWORLD.escapeHtml(draft.map.image)}" alt="">${blips.map(b=>`<button class="edit-blip ${b.category||'poi'} ${selected?.id===b.id?'selected':''}" data-id="${b.id}" style="left:${b.x}%;top:${b.y}%">${window.SIXWORLD.escapeHtml(b.symbol||'•')}</button>`).join('')}</div>
            <div class="inline-actions"><button class="solid-btn" id="newBlip">NEW BLIP</button><button class="ghost-btn" id="deleteBlip">DELETE SELECTED</button><button class="ghost-btn" id="exportMapJson">COPY MAP JSON</button></div>
            <p class="inline-note">Klicke auf die Map, um einen Blip zu setzen. Vorhandene Blips können ausgewählt und per Drag verschoben werden.</p>
            <div class="blip-list">${blips.map(b=>`<div class="blip-item ${selected?.id===b.id?'active':''}" data-pick-blip="${b.id}"><span class="blip-pill">${window.SIXWORLD.escapeHtml(b.symbol||'•')}</span><div><b>${window.SIXWORLD.escapeHtml(b.label||'Untitled')}</b><div class="inline-note">${window.SIXWORLD.escapeHtml(b.category||'poi')} · ${b.x}% / ${b.y}%</div></div></div>`).join('')}</div>
          </div>
          <div>
            <div class="admin-form" style="grid-template-columns:1fr">
              <div class="admin-field"><label>LABEL</label><input id="bLabel" value="${window.SIXWORLD.escapeHtml(selected?.label||'')}"></div>
              <div class="admin-field"><label>CATEGORY</label><select id="bCat">${categories.map(c=>`<option value="${c}" ${(selected?.category||'poi')===c?'selected':''}>${c}</option>`).join('')}</select></div>
              <div class="admin-field"><label>SYMBOL / SHORT TEXT</label><input id="bSymbol" value="${window.SIXWORLD.escapeHtml(selected?.symbol||'•')}"></div>
              <div class="admin-field"><label>DESCRIPTION</label><textarea id="bDesc">${window.SIXWORLD.escapeHtml(selected?.description||'')}</textarea></div>
              <div class="admin-field"><label>LINK</label><input id="bLink" value="${window.SIXWORLD.escapeHtml(selected?.link||'')}"></div>
              <div class="admin-field"><label>X %</label><input id="bX" type="number" min="0" max="100" step="0.1" value="${selected?.x??50}"></div>
              <div class="admin-field"><label>Y %</label><input id="bY" type="number" min="0" max="100" step="0.1" value="${selected?.y??50}"></div>
            </div>
          </div>
        </div>
      </section>
      <section class="admin-section">
        <h3>Map Filter Labels</h3>
        <div class="admin-form">
          ${draft.map.categories.map((cat,i)=>`
            <div class="admin-field"><label>${window.SIXWORLD.escapeHtml(cat.key)} - LABEL</label><input data-cat-index="${i}" data-cat-field="label" value="${window.SIXWORLD.escapeHtml(cat.label||'')}"></div>
            <div class="admin-field"><label>${window.SIXWORLD.escapeHtml(cat.key)} - LEGEND</label><input data-cat-index="${i}" data-cat-field="legend" value="${window.SIXWORLD.escapeHtml(cat.legend||'')}"></div>`).join('')}
        </div>
      </section>`;

    $('#mapImageInput').oninput=e=>{ draft.map.image=e.target.value; $('#mapEditPreview img').src=e.target.value; };
    $('#mapIntroInput').oninput=e=>{ draft.map.introLabel=e.target.value; };
    $$('[data-cat-index]').forEach(inp=>inp.oninput=e=>{ draft.map.categories[+e.target.dataset.catIndex][e.target.dataset.catField]=e.target.value; });

    function currentBlip(){ return draft.map.blips.find(x=>x.id===selectedBlipId) || null; }
    function syncCurrentBlip(){
      const b=currentBlip(); if(!b) return;
      b.label=$('#bLabel').value; b.category=$('#bCat').value; b.symbol=$('#bSymbol').value; b.description=$('#bDesc').value; b.link=$('#bLink').value; b.x=+$('#bX').value; b.y=+$('#bY').value;
      const el=$(`.edit-blip[data-id="${b.id}"]`); if(el){ el.textContent=b.symbol; el.style.left=b.x+'%'; el.style.top=b.y+'%'; el.className=`edit-blip ${b.category} selected`; }
      const item=$(`.blip-item[data-pick-blip="${b.id}"]`); if(item){ const label=item.querySelector('b'); const note=item.querySelector('.inline-note'); const pill=item.querySelector('.blip-pill'); if(label)label.textContent=b.label; if(note)note.textContent=`${b.category} · ${b.x}% / ${b.y}%`; if(pill)pill.textContent=b.symbol; }
    }
    ['bLabel','bCat','bSymbol','bDesc','bLink','bX','bY'].forEach(id=>$('#'+id).oninput=syncCurrentBlip);

    $$('.blip-item').forEach(item=>item.onclick=()=>{ selectedBlipId=item.dataset.pickBlip; renderMap(); });
    $$('.edit-blip').forEach(btn=>{
      btn.onclick=e=>{ e.stopPropagation(); selectedBlipId=btn.dataset.id; renderMap(); };
      let moving=false;
      btn.onpointerdown=e=>{ e.stopPropagation(); moving=true; btn.setPointerCapture(e.pointerId); selectedBlipId=btn.dataset.id; };
      btn.onpointermove=e=>{
        if(!moving) return;
        const b=draft.map.blips.find(x=>x.id===btn.dataset.id); if(!b) return;
        const r=$('#mapEditPreview').getBoundingClientRect();
        b.x=+Math.max(0,Math.min(100,((e.clientX-r.left)/r.width*100))).toFixed(1);
        b.y=+Math.max(0,Math.min(100,((e.clientY-r.top)/r.height*100))).toFixed(1);
        btn.style.left=b.x+'%'; btn.style.top=b.y+'%';
        if($('#bX')) $('#bX').value=b.x;
        if($('#bY')) $('#bY').value=b.y;
      };
      btn.onpointerup=()=>{ moving=false; renderMap(); };
    });

    $('#mapEditPreview').onclick=e=>{
      if(e.target.closest('.edit-blip')) return;
      const r=e.currentTarget.getBoundingClientRect();
      const b={
        id:uid('b'), x:+(((e.clientX-r.left)/r.width*100).toFixed(1)), y:+(((e.clientY-r.top)/r.height*100).toFixed(1)),
        label:'New Location', category:'poi', symbol:'•', description:'', link:''
      };
      draft.map.blips.push(b); selectedBlipId=b.id; renderMap();
    };
    $('#newBlip').onclick=()=>{ const b={id:uid('b'),x:50,y:50,label:'New Location',category:'poi',symbol:'•',description:'',link:''}; draft.map.blips.push(b); selectedBlipId=b.id; renderMap(); };
    $('#deleteBlip').onclick=()=>{ if(!selectedBlipId) return; draft.map.blips=draft.map.blips.filter(x=>x.id!==selectedBlipId); selectedBlipId=draft.map.blips[0]?.id||null; renderMap(); };
    $('#exportMapJson').onclick=async()=>{ try{ await navigator.clipboard.writeText(JSON.stringify(draft.map,null,2)); window.SIXWORLD.toast('Map JSON copied.'); }catch(e){ window.SIXWORLD.toast('Clipboard unavailable.'); } };
  }

  function renderSettings(){
    const s=draft.settings;
    const f=draft.feeds||{};
    $('#adminContent').innerHTML = `
      <section class="admin-section"><h3>Site Settings</h3><div class="admin-form">
        <div class="admin-field"><label>SITE NAME</label><input id="setName" value="${window.SIXWORLD.escapeHtml(s.siteName||'SIXWORLD')}"></div>
        <div class="admin-field"><label>SEARCH PLACEHOLDER</label><input id="setSearch" value="${window.SIXWORLD.escapeHtml(s.searchPlaceholder||'Search...')}"></div>
        <div class="admin-field"><label>PRIMARY ACCENT</label><input id="setAccent" type="color" value="${window.SIXWORLD.escapeHtml(s.accent||'#ff4fa3')}"></div>
        <div class="admin-field"><label>SECONDARY ACCENT</label><input id="setAccent2" type="color" value="${window.SIXWORLD.escapeHtml(s.accent2||'#42e6ee')}"></div>
      </div></section>
      <section class="admin-section"><h3>Feed Configuration</h3><div class="admin-form">
        <div class="admin-field"><label>LIVE FEEDS ENABLED</label><select id="feedEnabled"><option value="true" ${(f.enabled!==false)?'selected':''}>true</option><option value="false" ${(f.enabled===false)?'selected':''}>false</option></select></div>
        <div class="admin-field"><label>REDDIT SUBREDDIT</label><input id="feedSubreddit" value="${window.SIXWORLD.escapeHtml(f.subreddit||'GTA6')}"></div>
        <div class="admin-field"><label>X USERNAME</label><input id="feedXUser" value="${window.SIXWORLD.escapeHtml(f.xUser||'RockstarGames')}"></div>
        <div class="admin-field"><label>MAX LIVE ITEMS</label><input id="feedMaxItems" type="number" min="1" max="20" value="${window.SIXWORLD.escapeHtml(String(f.maxItems||6))}"></div>
      </div><div class="codebox" style="margin-top:16px">Für automatische Rockstar/X-Posts setze <b>X_BEARER_TOKEN</b> in deiner Deployment-Umgebung. Reddit Sync läuft über den enthaltenen Serverless-Endpunkt. Die Live-Feeds werden auf der Seite automatisch geladen und können im News-Tab zusätzlich in die manuelle News-Liste importiert werden.</div></section>`;
    ['setName','setSearch','setAccent','setAccent2'].forEach(id=>$('#'+id).oninput=()=>{
      draft.settings={siteName:$('#setName').value,searchPlaceholder:$('#setSearch').value,accent:$('#setAccent').value,accent2:$('#setAccent2').value};
    });
    ['feedEnabled','feedSubreddit','feedXUser','feedMaxItems'].forEach(id=>$('#'+id).oninput=()=>{
      draft.feeds={enabled:$('#feedEnabled').value==='true',subreddit:$('#feedSubreddit').value,xUser:$('#feedXUser').value,maxItems:+$('#feedMaxItems').value||6};
    });
  }

  function renderAccess(){
    const a=draft.access;
    $('#adminContent').innerHTML = `
      <section class="admin-section"><h3>Hidden Access</h3><div class="admin-form">
        <div class="admin-field"><label>HIDDEN TRIGGER TEXT</label><input id="accText" value="${window.SIXWORLD.escapeHtml(a.secretText||'sw_6.0.22')}"></div>
        <div class="admin-field"><label>VISIBLE PAGE</label><select id="accPage"><option value="map" ${a.secretPage==='map'?'selected':''}>map</option></select></div>
        <div class="admin-field"><label>LOCAL DEMO USERNAME</label><input id="accUser" value="${window.SIXWORLD.escapeHtml(a.demoUser||'admin')}"></div>
        <div class="admin-field"><label>LOCAL DEMO PASSWORD</label><input id="accPass" value="${window.SIXWORLD.escapeHtml(a.demoPass||'sixworld')}"></div>
      </div></section>
      <section class="admin-section"><h3>How It Works</h3><div class="access-box"><div class="codebox">Der kleine geheime Trigger erscheint nur auf der Map-Seite. Beim Klick öffnet sich das Login-Fenster. Im lokalen Preview nutzt die Seite die hier eingestellten Demo-Zugangsdaten. Nach Deployment kann der serverseitige Login über die enthaltenen API-Endpunkte übernommen werden.</div></div></section>`;
    ['accText','accPage','accUser','accPass'].forEach(id=>$('#'+id).oninput=()=>{
      draft.access={secretText:$('#accText').value,secretPage:$('#accPage').value,demoUser:$('#accUser').value,demoPass:$('#accPass').value};
    });
  }
})();
