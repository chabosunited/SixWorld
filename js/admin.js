(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
  const clone=o=>JSON.parse(JSON.stringify(o));

  let tab='dashboard', draft=null;
  let editIds={hero:null, leaks:null, screens:null, news:null};
  let selectedBlipId=null;
  let activeEntityConfig=null;
  let adminMapScale=1, adminMapX=0, adminMapY=0;


  const adminMapIconPaths={
    district:'<path d="M4 20V8l4-2v14M10 20V4h6v16M18 20v-9l3 2v7M3 20h19"/><path d="M12 7h2M12 10h2M12 13h2M6 11h1M6 14h1M19 15h1"/>',
    landmark:'<path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.02l-5.5 2.9 1.05-6.12L3.1 9.47l6.15-.9L12 3Z"/>',
    activity:'<circle cx="13" cy="5" r="2"/><path d="m9 21 2.5-6-3-2 2.2-4 3.3 2 3.5-1.5M13 12l3 3 4 1M8.5 13 5 17"/>',
    shop:'<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    safehouse:'<path d="m3 11 9-7 9 7v9H3v-9Z"/><path d="M9 20v-6h6v6"/>',
    secret:'<path d="m12 3 8 9-8 9-8-9 8-9Z"/><path d="m8 12 3 3 5-6"/>',
    transport:'<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M7 8h10M8 18v3M16 18v3M8 13h.01M16 13h.01"/>'
  };
  function adminMapIconSvg(category){const k=adminMapIconPaths[category]?category:'landmark';return `<svg class="map-custom-icon blip-icon" viewBox="0 0 24 24" aria-hidden="true">${adminMapIconPaths[k]}</svg>`;}

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
    draft.map.image ||= 'assets/InteractiveMap/GTA6MAP.png';
    draft.map.logo ||= 'assets/logo/Leonidaloga.png';
    draft.map.updatedDate ||= 'May 12, 2025';
    draft.map.blips ||= [];
    const requiredCats=[
      {key:'district',label:'DISTRICTS',legend:'Districts',short:'▦',icon:'▦'},
      {key:'landmark',label:'LANDMARKS',legend:'Landmarks',short:'★',icon:'☆'},
      {key:'activity',label:'ACTIVITIES',legend:'Activities',short:'⚑',icon:'⚑'},
      {key:'shop',label:'SHOPS',legend:'Shops',short:'▣',icon:'▣'},
      {key:'safehouse',label:'SAFEHOUSES',legend:'Safehouses',short:'⌂',icon:'⌂'},
      {key:'secret',label:'SECRETS',legend:'Secrets',short:'◇',icon:'◇'},
      {key:'transport',label:'TRANSPORT',legend:'Transport',short:'▰',icon:'▰'}
    ];
    const current=new Map((draft.map.categories||[]).map(x=>[x.key,x]));
    draft.map.categories=requiredCats.map(x=>({...x,...(current.get(x.key)||{})}));
    draft.settings ||= {siteName:'SIXWORLD',searchPlaceholder:'Search...',accent:'#ff4fa3',accent2:'#42e6ee'};
    draft.feeds ||= {};
    draft.feeds.enabled = draft.feeds.enabled !== false;
    draft.feeds.subreddits = Array.isArray(draft.feeds.subreddits) && draft.feeds.subreddits.length
      ? draft.feeds.subreddits
      : ['GTA6unmoderated','GTA6_NEW'];
    draft.feeds.xUser ||= 'RockstarGames';
    draft.feeds.maxItems = Math.max(1, Number(draft.feeds.maxItems)||10);
    delete draft.feeds.subreddit;
    draft.access ||= {secretText:'sw_6.0.22',secretPage:'map',demoUser:'admin',demoPass:'sixworld'};
  }

  async function saveDraft(successMessage='Changes saved.'){
    normalizeDraft();
    const topSave=$('#saveAdmin');
    const oldTopText=topSave?.textContent;
    if(topSave){topSave.disabled=true;topSave.textContent='SAVING...';}

    try{
      if(window.SIXWORLD.backend){
        const r=await fetch('/api/admin/content',{
          method:'PUT',
          credentials:'same-origin',
          headers:{'content-type':'application/json','cache-control':'no-cache'},
          body:JSON.stringify(draft)
        });
        const payload=await r.json().catch(()=>null);
        if(!r.ok){
          const msg=payload?.error || `HTTP ${r.status}`;
          console.error('SIXWORLD admin save failed:',r.status,payload);
          window.SIXWORLD.toast(`Save failed: ${msg}`);
          return false;
        }
        // The API returns the persisted D1 document. Use that as source of truth.
        if(payload?.content){ draft=clone(payload.content); normalizeDraft(); }
      }else{
        localStorage.setItem(window.SIXWORLD.FALLBACK_KEY,JSON.stringify(draft));
      }

      window.SIXWORLD.content=clone(draft);
      window.SIXWORLD.renderAll();
      window.SIXWORLD.toast(successMessage);
      return true;
    }catch(err){
      console.error('SIXWORLD admin save error:',err);
      window.SIXWORLD.toast('Save failed. Check the browser console / login session.');
      return false;
    }finally{
      if(topSave){topSave.disabled=false;topSave.textContent=oldTopText||'SAVE CHANGES';}
    }
  }

  function stat(n,l){ return `<div class="stat-card"><b>${n}</b><span>${l}</span></div>`; }
  function adminRow(img,title,sub,arr,id){
    const active = editIds[arr]!=null && String(editIds[arr])===String(id) ? ' editing' : '';
    return `<div class="admin-row${active}" data-edit="${id}" data-array="${arr}">
      <img src="${img||'assets/logo/sixworldlogo.png'}" alt="">
      <div class="admin-row-copy"><b>${window.SIXWORLD.escapeHtml(title)}</b><small>${window.SIXWORLD.escapeHtml(sub||'')}</small></div>
      <div class="admin-row-actions">
        <button class="admin-edit-btn" data-edit-btn="${id}" data-array="${arr}" title="Edit">EDIT</button>
        <button class="admin-delete-btn" data-delete="${id}" data-array="${arr}" title="Delete">×</button>
      </div>
    </div>`;
  }
  function getEntityList(key){
    if(key==='hero') return draft.hero;
    if(key==='leaks') return draft.leaks;
    if(key==='screens') return draft.screenshots;
    if(key==='news') return draft.news;
    return null;
  }

  function bindDeletes(){ /* handled by delegated listener */ }
  function bindSelects(){ /* handled by delegated listener */ }

  function startEdit(key,id){
    if(!Object.prototype.hasOwnProperty.call(editIds,key)) return;
    editIds[key]=String(id);
    renderTab();
    setTimeout(()=>document.querySelector('.admin-section.editor-section')?.scrollIntoView({behavior:'smooth',block:'start'}),30);
  }

  async function saveActiveEntity(button){
    const config=activeEntityConfig;
    if(!config){ window.SIXWORLD.toast('Editor error: no active content type.'); return; }
    const {key,fields}=config;
    const list=getEntityList(key);
    if(!list){ window.SIXWORLD.toast('Editor error: invalid content list.'); return; }

    const originalText=button?.textContent || 'UPDATE CONTENT';
    if(button){ button.disabled=true; button.textContent='SAVING...'; }
    window.SIXWORLD.toast('Publishing changes...');

    try{
      const values={};
      for(const f of fields){
        const field=$(`[data-entity-field="${key}.${f.name}"]`) || $(`#${key}_${f.name}`);
        values[f.name]=field ? field.value : '';
      }

      const activeEditId=editIds[key];
      let message='Content added & published.';
      if(activeEditId!=null){
        const index=list.findIndex(x=>String(x.id)===String(activeEditId));
        if(index<0){
          window.SIXWORLD.toast('Update failed: content item not found.');
          return;
        }
        Object.assign(list[index],values);
        message='Content updated & published.';
      }else{
        list.unshift({id:uid(key.slice(0,1)),...values});
      }

      const ok=await saveDraft(message);
      if(!ok) return;

      editIds[key]=null;
      activeEntityConfig=null;
      renderTab();
    }catch(err){
      console.error('SIXWORLD entity update error:',err);
      window.SIXWORLD.toast('Update failed due to a JavaScript error.');
    }finally{
      if(button && document.contains(button)){ button.disabled=false; button.textContent=originalText; }
    }
  }

  $('#adminContent').addEventListener('click',async e=>{
    const saveBtn=e.target.closest('[data-action="save-entity"]');
    if(saveBtn){
      e.preventDefault(); e.stopPropagation();
      await saveActiveEntity(saveBtn);
      return;
    }
    const newBtn=e.target.closest('[data-action="new-entity"]');
    if(newBtn){
      e.preventDefault(); e.stopPropagation();
      const key=newBtn.dataset.entityKey;
      if(key && Object.prototype.hasOwnProperty.call(editIds,key)) editIds[key]=null;
      renderTab();
      return;
    }
    const deleteBtn=e.target.closest('[data-delete]');
    if(deleteBtn){
      e.preventDefault(); e.stopPropagation();
      const key=deleteBtn.dataset.array;
      const list=getEntityList(key);
      if(list){
        const index=list.findIndex(x=>String(x.id)===String(deleteBtn.dataset.delete));
        if(index>=0) list.splice(index,1);
        if(editIds[key]!=null && String(editIds[key])===String(deleteBtn.dataset.delete)) editIds[key]=null;
        renderTab();
      }
      return;
    }
    const editBtn=e.target.closest('[data-edit-btn]');
    if(editBtn){
      e.preventDefault(); e.stopPropagation();
      startEdit(editBtn.dataset.array,editBtn.dataset.editBtn);
      return;
    }
    const row=e.target.closest('.admin-row[data-edit]');
    if(row){
      e.preventDefault();
      startEdit(row.dataset.array,row.dataset.edit);
    }
  });

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
    const {key,title,fields,imgKey,subtitle}=config;
    const list=getEntityList(key) || [];
    const editId=editIds[key];
    const current=list.find(x=>String(x.id)===String(editId)) || {};
    activeEntityConfig={...config,list:null};

    const formHtml=fields.map(f=>{
      const val=current[f.name] ?? f.default ?? '';
      const common=`id="${key}_${f.name}" data-entity-field="${key}.${f.name}"`;
      if(f.type==='textarea') return `<div class="admin-field ${f.full?'full':''}"><label>${f.label}</label><textarea ${common}>${window.SIXWORLD.escapeHtml(val)}</textarea></div>`;
      if(f.type==='select') return `<div class="admin-field ${f.full?'full':''}"><label>${f.label}</label><select ${common}>${f.options.map(opt=>`<option value="${window.SIXWORLD.escapeHtml(opt)}" ${String(val)===String(opt)?'selected':''}>${window.SIXWORLD.escapeHtml(opt)}</option>`).join('')}</select></div>`;
      return `<div class="admin-field ${f.full?'full':''}"><label>${f.label}</label><input ${common} ${f.type?`type="${f.type}"`:''} value="${window.SIXWORLD.escapeHtml(val)}"></div>`;
    }).join('');

    $('#adminContent').innerHTML=`
      <section class="admin-section">
        <div class="admin-section-heading"><div><h3>${title}</h3><p class="inline-note">Klicke auf einen Eintrag oder auf <b>EDIT</b>, um vorhandene Inhalte zu bearbeiten.</p></div></div>
        <div class="admin-list">${list.map(x=>adminRow(x[imgKey],x.title||x.eyebrow||x.label,subtitle(x),key,x.id)).join('')}</div>
      </section>
      <section class="admin-section editor-section">
        <h3>${editId!=null?'Edit Selected':'Create New'}</h3>
        ${editId!=null?'<div class="editing-badge">EDIT MODE · vorhandener Inhalt</div>':''}
        <div class="admin-form">${formHtml}</div>
        <div class="inline-actions">
          <button type="button" class="solid-btn" id="saveEntity" data-action="save-entity" data-entity-key="${key}">${editId!=null?'UPDATE CONTENT':'ADD NEW'}</button>
          <button type="button" class="ghost-btn" id="newEntity" data-action="new-entity" data-entity-key="${key}">CLEAR / NEW</button>
        </div>
      </section>`;
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
      const subreddits = Array.isArray(draft.feeds?.subreddits) && draft.feeds.subreddits.length
        ? draft.feeds.subreddits
        : ['GTA6unmoderated','GTA6_NEW'];
      const xUser = draft.feeds?.xUser || 'RockstarGames';
      const [reddit, xFeed] = await Promise.all([
        fetch(`/api/feed/reddit?subreddits=${encodeURIComponent(subreddits.join(','))}`).then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
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
    const blips=draft.map.blips||[];
    const categories=(draft.map.categories||[]).map(x=>x.key);
    const selected=blips.find(x=>String(x.id)===String(selectedBlipId))||blips[0]||null;
    if(selected&&!selectedBlipId) selectedBlipId=selected.id;
    const tagValue=Array.isArray(selected?.tags)?selected.tags.join(', '):(selected?.tags||'');
    $('#adminContent').innerHTML=`
      <section class="admin-section">
        <h3>Map Setup</h3>
        <p class="inline-note">Zoome mit Mausrad oder + / − in die Map. Ziehe die Map zum Verschieben. Ein kurzer Klick auf eine freie Stelle setzt eine neue Location.</p>
        <div class="admin-form" style="margin-top:14px">
          <div class="admin-field"><label>MAP IMAGE PATH / URL</label><input id="mapImageInput" value="${window.SIXWORLD.escapeHtml(draft.map.image||'assets/InteractiveMap/GTA6MAP.png')}"></div>
          <div class="admin-field"><label>LEONIDA LOGO PATH / URL</label><input id="mapLogoInput" value="${window.SIXWORLD.escapeHtml(draft.map.logo||'assets/logo/Leonidaloga.png')}"></div>
          <div class="admin-field"><label>MAP INTRO LABEL</label><input id="mapIntroInput" value="${window.SIXWORLD.escapeHtml(draft.map.introLabel||'VICE CITY & BEYOND')}"></div>
          <div class="admin-field"><label>LAST UPDATED</label><input id="mapUpdatedInput" value="${window.SIXWORLD.escapeHtml(draft.map.updatedDate||'May 12, 2025')}"></div>
        </div>
        <div class="map-editor-layout" style="margin-top:18px">
          <div>
            <div class="map-editor-preview" id="mapEditPreview">
              <div class="admin-map-stage" id="adminMapStage">
                <img src="${window.SIXWORLD.escapeHtml(draft.map.image)}" alt="" draggable="false">
                <div class="admin-map-blips">${blips.map(b=>`<button class="edit-blip ${b.category||'landmark'} ${String(selected?.id)===String(b.id)?'selected':''}" data-id="${window.SIXWORLD.escapeHtml(b.id)}" style="left:${b.x}%;top:${b.y}%">${adminMapIconSvg(b.category)}</button>`).join('')}</div>
              </div>
              <div class="admin-map-toolbar" aria-label="Admin map tools">
                <button id="adminZoomIn" type="button" title="Zoom in">+</button>
                <button id="adminZoomOut" type="button" title="Zoom out">−</button>
                <button id="adminZoomReset" type="button" title="Reset map">⌖</button>
              </div>
              <div class="admin-map-zoom-label" id="adminMapZoomLabel">100%</div>
            </div>
            <div class="inline-actions"><button class="solid-btn" id="newBlip">NEW LOCATION</button><button class="ghost-btn" id="deleteBlip">DELETE SELECTED</button><button class="ghost-btn" id="exportMapJson">COPY MAP JSON</button></div>
            <p class="inline-note admin-map-help">Marker und Icons liegen direkt auf der Map und skalieren beim Zoomen proportional mit. So bleiben sie exakt an ihrer Position.</p>
            <div class="blip-list">${blips.map(b=>`<div class="blip-item ${String(selected?.id)===String(b.id)?'active':''}" data-pick-blip="${window.SIXWORLD.escapeHtml(b.id)}"><span class="blip-pill">${window.SIXWORLD.escapeHtml(b.symbol||'•')}</span><div><b>${window.SIXWORLD.escapeHtml(b.label||'Untitled')}</b><div class="inline-note">${window.SIXWORLD.escapeHtml(b.category||'landmark')} · ${b.x}% / ${b.y}%</div></div></div>`).join('')}</div>
          </div>
          <div class="admin-map-fields">
            <div class="admin-field full"><label>LOCATION NAME</label><input id="bLabel" value="${window.SIXWORLD.escapeHtml(selected?.label||'')}"></div>
            <div class="admin-field"><label>CATEGORY</label><select id="bCat">${categories.map(c=>`<option value="${window.SIXWORLD.escapeHtml(c)}" ${(selected?.category||'landmark')===c?'selected':''}>${window.SIXWORLD.escapeHtml(c)}</option>`).join('')}</select></div>
            <div class="admin-field"><label>SYMBOL / ICON TEXT</label><input id="bSymbol" value="${window.SIXWORLD.escapeHtml(selected?.symbol||'★')}"></div>
            <div class="admin-field full"><label>DETAIL IMAGE PATH / URL</label><input id="bImage" value="${window.SIXWORLD.escapeHtml(selected?.image||'assets/nighttimepink.webp')}"></div>
            <div class="admin-field"><label>REGION</label><input id="bRegion" value="${window.SIXWORLD.escapeHtml(selected?.region||'Leonida')}"></div>
            <div class="admin-field"><label>DISTRICT</label><input id="bDistrict" value="${window.SIXWORLD.escapeHtml(selected?.district||'')}"></div>
            <div class="admin-field"><label>POINTS OF INTEREST</label><input id="bPoiCount" type="number" min="0" value="${selected?.poiCount??0}"></div>
            <div class="admin-field"><label>DISCOVERED DATE</label><input id="bDiscovered" value="${window.SIXWORLD.escapeHtml(selected?.discovered||'')}"></div>
            <div class="admin-field full"><label>TAGS (comma separated)</label><input id="bTags" value="${window.SIXWORLD.escapeHtml(tagValue)}"></div>
            <div class="admin-field full"><label>DESCRIPTION</label><textarea id="bDesc">${window.SIXWORLD.escapeHtml(selected?.description||'')}</textarea></div>
            <div class="admin-field full"><label>LINK</label><input id="bLink" value="${window.SIXWORLD.escapeHtml(selected?.link||'#map')}"></div>
            <div class="admin-field"><label>X %</label><input id="bX" type="number" min="0" max="100" step="0.1" value="${selected?.x??50}"></div>
            <div class="admin-field"><label>Y %</label><input id="bY" type="number" min="0" max="100" step="0.1" value="${selected?.y??50}"></div>
            <div class="admin-field"><label>FEATURED</label><select id="bFeatured"><option value="false" ${selected?.featured?'':'selected'}>false</option><option value="true" ${selected?.featured?'selected':''}>true</option></select></div>
          </div>
        </div>
      </section>
      <section class="admin-section">
        <h3>Map Filter Labels</h3>
        <div class="admin-form">${(draft.map.categories||[]).map((cat,i)=>`
          <div class="admin-field"><label>${window.SIXWORLD.escapeHtml(cat.key)} - LABEL</label><input data-cat-index="${i}" data-cat-field="label" value="${window.SIXWORLD.escapeHtml(cat.label||'')}"></div>
          <div class="admin-field"><label>${window.SIXWORLD.escapeHtml(cat.key)} - LEGEND</label><input data-cat-index="${i}" data-cat-field="legend" value="${window.SIXWORLD.escapeHtml(cat.legend||'')}"></div>`).join('')}</div>
      </section>`;

    const preview=$('#mapEditPreview'), stage=$('#adminMapStage');
    const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
    function applyAdminMap(){
      if(!stage)return;
      stage.style.transform=`translate(calc(-50% + ${adminMapX}px),calc(-50% + ${adminMapY}px)) scale(${adminMapScale})`;
      const label=$('#adminMapZoomLabel'); if(label)label.textContent=Math.round(adminMapScale*100)+'%';
    }
    function setAdminZoom(next){adminMapScale=clamp(next,.75,4);applyAdminMap();}
    function resetAdminMap(){adminMapScale=1;adminMapX=0;adminMapY=0;applyAdminMap();}
    applyAdminMap();

    $('#mapImageInput').oninput=e=>{draft.map.image=e.target.value;const img=$('#adminMapStage img');if(img)img.src=e.target.value};
    $('#mapLogoInput').oninput=e=>draft.map.logo=e.target.value;
    $('#mapIntroInput').oninput=e=>draft.map.introLabel=e.target.value;
    $('#mapUpdatedInput').oninput=e=>draft.map.updatedDate=e.target.value;
    $$('[data-cat-index]').forEach(inp=>inp.oninput=e=>{draft.map.categories[+e.target.dataset.catIndex][e.target.dataset.catField]=e.target.value});

    ['adminZoomIn','adminZoomOut','adminZoomReset'].forEach(id=>$('#'+id)?.addEventListener('pointerdown',e=>e.stopPropagation()));
    $('#adminZoomIn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setAdminZoom(adminMapScale+.25)});
    $('#adminZoomOut')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setAdminZoom(adminMapScale-.25)});
    $('#adminZoomReset')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();resetAdminMap()});
    preview?.addEventListener('wheel',e=>{e.preventDefault();setAdminZoom(adminMapScale+(e.deltaY<0?.15:-.15))},{passive:false});
    preview?.querySelector('img')?.addEventListener('dragstart',e=>e.preventDefault());

    const currentBlip=()=>draft.map.blips.find(x=>String(x.id)===String(selectedBlipId))||null;
    function syncCurrentBlip(){
      const b=currentBlip();if(!b)return;
      b.label=$('#bLabel').value;b.category=$('#bCat').value;b.symbol=$('#bSymbol').value;b.image=$('#bImage').value;
      b.region=$('#bRegion').value;b.district=$('#bDistrict').value;b.poiCount=+$('#bPoiCount').value||0;b.discovered=$('#bDiscovered').value;
      b.tags=$('#bTags').value.split(',').map(x=>x.trim()).filter(Boolean);b.description=$('#bDesc').value;b.link=$('#bLink').value;
      b.x=+$('#bX').value;b.y=+$('#bY').value;b.featured=$('#bFeatured').value==='true';
      const el=$(`.edit-blip[data-id="${CSS.escape(String(b.id))}"]`);if(el){el.innerHTML=adminMapIconSvg(b.category);el.style.left=b.x+'%';el.style.top=b.y+'%';el.className=`edit-blip ${b.category} selected`}
      const row=$(`.blip-item[data-pick-blip="${CSS.escape(String(b.id))}"]`);if(row){row.querySelector('b').textContent=b.label;const n=row.querySelector('.inline-note');if(n)n.textContent=`${b.category} · ${b.x}% / ${b.y}%`;}
    }
    ['bLabel','bCat','bSymbol','bImage','bRegion','bDistrict','bPoiCount','bDiscovered','bTags','bDesc','bLink','bX','bY','bFeatured'].forEach(id=>$('#'+id)?.addEventListener('input',syncCurrentBlip));
    $$('.blip-item').forEach(item=>item.onclick=()=>{selectedBlipId=item.dataset.pickBlip;renderMap()});

    $$('.edit-blip').forEach(btn=>{
      btn.onclick=e=>{e.stopPropagation();selectedBlipId=btn.dataset.id;renderMap()};
      let moving=false;
      btn.onpointerdown=e=>{e.preventDefault();e.stopPropagation();moving=true;btn.setPointerCapture(e.pointerId);selectedBlipId=btn.dataset.id};
      btn.onpointermove=e=>{
        if(!moving)return;
        const b=draft.map.blips.find(x=>String(x.id)===String(btn.dataset.id));if(!b)return;
        const r=stage.getBoundingClientRect();
        b.x=+clamp((e.clientX-r.left)/r.width*100,0,100).toFixed(1);
        b.y=+clamp((e.clientY-r.top)/r.height*100,0,100).toFixed(1);
        btn.style.left=b.x+'%';btn.style.top=b.y+'%';if($('#bX'))$('#bX').value=b.x;if($('#bY'))$('#bY').value=b.y;
        const row=$(`.blip-item[data-pick-blip="${CSS.escape(String(b.id))}"] .inline-note`);if(row)row.textContent=`${b.category} · ${b.x}% / ${b.y}%`;
      };
      btn.onpointerup=e=>{moving=false;try{btn.releasePointerCapture(e.pointerId)}catch(_){}};
      btn.ondragstart=e=>e.preventDefault();
    });

    let panning=false,startX=0,startY=0,baseX=0,baseY=0,moved=false;
    preview?.addEventListener('pointerdown',e=>{
      if(e.target.closest('.edit-blip,.admin-map-toolbar'))return;
      e.preventDefault();panning=true;moved=false;startX=e.clientX;startY=e.clientY;baseX=adminMapX;baseY=adminMapY;preview.classList.add('dragging');preview.setPointerCapture(e.pointerId);
    });
    preview?.addEventListener('pointermove',e=>{
      if(!panning)return;
      const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.hypot(dx,dy)>4)moved=true;
      adminMapX=baseX+dx;adminMapY=baseY+dy;applyAdminMap();
    });
    preview?.addEventListener('pointerup',e=>{
      if(!panning)return;panning=false;preview.classList.remove('dragging');try{preview.releasePointerCapture(e.pointerId)}catch(_){}
      if(moved)return;
      const r=stage.getBoundingClientRect();
      const x=+clamp((e.clientX-r.left)/r.width*100,0,100).toFixed(1),y=+clamp((e.clientY-r.top)/r.height*100,0,100).toFixed(1);
      const b={id:uid('loc'),x,y,label:'New Location',category:'landmark',symbol:'★',image:'assets/nighttimepink.webp',region:'Leonida',district:'',poiCount:0,discovered:'',tags:['LANDMARK'],description:'',link:'#map',featured:false};
      draft.map.blips.push(b);selectedBlipId=b.id;renderMap();
    });

    $('#newBlip').onclick=()=>{const b={id:uid('loc'),x:50,y:50,label:'New Location',category:'landmark',symbol:'★',image:'assets/nighttimepink.webp',region:'Leonida',district:'',poiCount:0,discovered:'',tags:['LANDMARK'],description:'',link:'#map',featured:false};draft.map.blips.push(b);selectedBlipId=b.id;renderMap()};
    $('#deleteBlip').onclick=()=>{if(!selectedBlipId)return;draft.map.blips=draft.map.blips.filter(x=>String(x.id)!==String(selectedBlipId));selectedBlipId=draft.map.blips[0]?.id||null;renderMap()};
    $('#exportMapJson').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(draft.map,null,2));window.SIXWORLD.toast('Map JSON copied.')}catch(e){window.SIXWORLD.toast('Clipboard unavailable.')}};
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
        <div class="admin-field full"><label>REDDIT FEEDS (one per line or comma-separated)</label><textarea id="feedSubreddits" rows="4">${window.SIXWORLD.escapeHtml((Array.isArray(f.subreddits)&&f.subreddits.length?f.subreddits:['GTA6unmoderated','GTA6_NEW']).join('\n'))}</textarea></div>
        <div class="admin-field"><label>X USERNAME</label><input id="feedXUser" value="${window.SIXWORLD.escapeHtml(f.xUser||'RockstarGames')}"></div>
        <div class="admin-field"><label>MAX LIVE ITEMS</label><input id="feedMaxItems" type="number" min="1" max="30" value="${window.SIXWORLD.escapeHtml(String(f.maxItems||10))}"></div>
      </div><div class="codebox" style="margin-top:16px"><b>Active Reddit feeds:</b> r/GTA6unmoderated and r/GTA6_NEW. Neue Posts werden automatisch auf der News-Seite geladen. Du kannst hier später weitere Subreddits ergänzen oder entfernen. Der Serverless-Feed wird für wenige Minuten gecacht, damit Reddit nicht bei jedem Besucher neu angefragt wird.</div></section>`;
    ['setName','setSearch','setAccent','setAccent2'].forEach(id=>$('#'+id).oninput=()=>{
      draft.settings={siteName:$('#setName').value,searchPlaceholder:$('#setSearch').value,accent:$('#setAccent').value,accent2:$('#setAccent2').value};
    });
    ['feedEnabled','feedSubreddits','feedXUser','feedMaxItems'].forEach(id=>$('#'+id).oninput=()=>{
      const subreddits=$('#feedSubreddits').value.split(/[\n,]+/).map(x=>x.trim().replace(/^r\//i,'')).filter(Boolean);
      draft.feeds={enabled:$('#feedEnabled').value==='true',subreddits:subreddits.length?subreddits:['GTA6unmoderated','GTA6_NEW'],xUser:$('#feedXUser').value,maxItems:+$('#feedMaxItems').value||10};
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
