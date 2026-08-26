(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
  const clone=o=>JSON.parse(JSON.stringify(o));

  let tab='dashboard', draft=null;
  let editIds={hero:null, leaks:null, screens:null, news:null};
  let selectedBlipId=null;
  let activeEntityConfig=null;
  let adminMapScale=1, adminMapX=0, adminMapY=0;
  let reorderState={key:null,id:null};
  let adminMapFilter='all';


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
    news:'News', comments:'Comments', map:'Interactive Map', settings:'Settings', access:'Access'
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
    draft.hero.forEach(slide=>{
      slide.mediaType ||= slide.video ? 'video' : 'image';
      slide.duration = Math.max(2,Math.min(60,Number(slide.duration)||7));
      slide.video ||= '';
    });
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
    draft.map.communityMapping ||= {enabled:true,version:1,excludedIds:[]};
    draft.map.communityMapping.enabled = draft.map.communityMapping.enabled !== false;
    draft.map.communityMapping.excludedIds = Array.isArray(draft.map.communityMapping.excludedIds) ? draft.map.communityMapping.excludedIds : [];
    draft.settings ||= {};
    draft.settings.siteName ||= 'SIXWORLD';
    draft.settings.searchPlaceholder ||= 'Search...';
    draft.settings.accent ||= '#ff4fa3';
    draft.settings.accent2 ||= '#42e6ee';
    draft.settings.backgroundImage ||= 'assets/site-background.png';
    draft.settings.defaultLanguage ||= 'en';
    draft.settings.githubAutoBackup = draft.settings.githubAutoBackup !== false;
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

  function downloadContentBackup(){
    normalizeDraft();
    const text=JSON.stringify(draft,null,2)+'\n';
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const a=document.createElement('a');
    a.href=url;
    a.download=`sixworld-content-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    localStorage.setItem(window.SIXWORLD.FALLBACK_KEY,JSON.stringify(draft));
    window.SIXWORLD.toast('Local content backup downloaded.');
  }

  async function getGithubBackupStatus(){
    if(!window.SIXWORLD.backend) return {configured:false,local:true};
    try{
      const r=await fetch('/api/admin/github-backup',{credentials:'same-origin',cache:'no-store'});
      const d=await r.json().catch(()=>null);
      return d||{configured:false};
    }catch(e){
      return {configured:false,error:'Backup status unavailable.'};
    }
  }

  async function backupDraftToGithub({silent=false}={}){
    if(!window.SIXWORLD.backend){
      if(!silent) window.SIXWORLD.toast('GitHub backup is available on the deployed admin only.');
      return {ok:false,local:true};
    }
    try{
      const r=await fetch('/api/admin/github-backup',{
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json','cache-control':'no-cache'},
        body:'{}'
      });
      const d=await r.json().catch(()=>null);
      if(!r.ok){
        if(!silent) window.SIXWORLD.toast(d?.hint || d?.error || 'GitHub backup failed.');
        return {ok:false,...(d||{})};
      }
      if(!silent) window.SIXWORLD.toast(d?.skipped?'GitHub backup already up to date.':'GitHub content backup updated.');
      return {ok:true,...(d||{})};
    }catch(e){
      if(!silent) window.SIXWORLD.toast('GitHub backup unavailable.');
      return {ok:false,error:String(e?.message||e)};
    }
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

      // Always keep a current browser-local snapshot on the admin device.
      // loadContent() already knows how to use this if the API is unavailable.
      localStorage.setItem(window.SIXWORLD.FALLBACK_KEY,JSON.stringify(draft));

      window.SIXWORLD.content=clone(draft);
      window.SIXWORLD.renderAll();

      let backupResult=null;
      if(window.SIXWORLD.backend && draft.settings?.githubAutoBackup!==false){
        backupResult=await backupDraftToGithub({silent:true});
      }

      if(backupResult?.ok){
        window.SIXWORLD.toast(backupResult.skipped
          ? `${successMessage} · GitHub backup current.`
          : `${successMessage} · GitHub backup updated.`);
      }else if(window.SIXWORLD.backend && draft.settings?.githubAutoBackup!==false){
        window.SIXWORLD.toast(`${successMessage} · GitHub backup pending/not configured.`);
      }else{
        window.SIXWORLD.toast(successMessage);
      }
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
    const reorderable=['hero','leaks','screens'].includes(arr);
    const dragHandle=reorderable
      ? `<button class="admin-drag-handle" draggable="true" data-drag-handle="${window.SIXWORLD.escapeHtml(id)}" data-array="${arr}" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</button>`
      : '';
    return `<div class="admin-row${active}" data-edit="${id}" data-array="${arr}">
      ${dragHandle}
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
    if(e.target.closest('[data-drag-handle]')) return;
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

  $('#adminContent').addEventListener('dragstart',e=>{
    const handle=e.target.closest('[data-drag-handle]');
    if(!handle) return;
    const key=handle.dataset.array;
    if(!['hero','leaks','screens'].includes(key)) return;
    reorderState={key,id:String(handle.dataset.dragHandle)};
    const row=handle.closest('.admin-row');
    row?.classList.add('dragging-row');
    try{
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',reorderState.id);
      if(row)e.dataTransfer.setDragImage(row,30,20);
    }catch(_){}
  });

  $('#adminContent').addEventListener('dragover',e=>{
    if(!reorderState.key) return;
    const row=e.target.closest(`.admin-row[data-array="${reorderState.key}"]`);
    if(!row || String(row.dataset.edit)===String(reorderState.id)) return;
    e.preventDefault();
    $$('.admin-row.drop-before,.admin-row.drop-after','#adminContent').forEach(x=>x.classList.remove('drop-before','drop-after'));
    const rect=row.getBoundingClientRect();
    row.classList.add(e.clientY < rect.top + rect.height/2 ? 'drop-before' : 'drop-after');
  });

  $('#adminContent').addEventListener('drop',async e=>{
    if(!reorderState.key) return;
    const row=e.target.closest(`.admin-row[data-array="${reorderState.key}"]`);
    if(!row) return;
    e.preventDefault();
    const key=reorderState.key;
    const list=getEntityList(key);
    if(!list) return;
    const from=list.findIndex(x=>String(x.id)===String(reorderState.id));
    let to=list.findIndex(x=>String(x.id)===String(row.dataset.edit));
    if(from<0 || to<0 || from===to) return;
    const rect=row.getBoundingClientRect();
    const after=e.clientY >= rect.top + rect.height/2;
    const [moved]=list.splice(from,1);
    to=list.findIndex(x=>String(x.id)===String(row.dataset.edit));
    list.splice(after?to+1:to,0,moved);
    reorderState={key:null,id:null};
    $$('.admin-row','#adminContent').forEach(x=>x.classList.remove('dragging-row','drop-before','drop-after'));
    await saveDraft('Order updated & published.');
    renderTab();
  });

  $('#adminContent').addEventListener('dragend',()=>{
    reorderState={key:null,id:null};
    $$('.admin-row','#adminContent').forEach(x=>x.classList.remove('dragging-row','drop-before','drop-after'));
  });

  function setTab(next){ tab=next; renderTab(); }

  function renderTab(){
    $$('.admin-nav [data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));
    $('#adminTitle').textContent=titles[tab] || 'Overview';
    ({dashboard:renderDash,hero:renderHero,leaks:renderLeaks,screens:renderScreens,news:renderNews,comments:renderComments,map:renderMap,settings:renderSettings,access:renderAccess}[tab])();
  }

  function renderDash(){
    $('#adminContent').innerHTML = `
      <div class="admin-cards">
        ${stat(draft.hero.length,'HERO SLIDES')}
        ${stat(draft.leaks.length,'VIDEOS')}
        ${stat(draft.screenshots.length,'SCREENSHOTS')}
        ${stat(draft.map.blips.length,'MAP BLIPS')}
      </div>
      <section class="admin-section"><h3>Content Control Center</h3><p class="inline-note">Manage the homepage, videos, screenshots, news and interactive map. In Cloudflare/D1 mode the data is stored centrally; local preview data is stored in the browser.</p><div class="inline-actions"><button class="ghost-btn" id="dashGoHero">EDIT HERO</button><button class="ghost-btn" id="dashGoMap">EDIT MAP</button><button class="ghost-btn" id="dashGoNews">EDIT NEWS</button></div></section>
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
        <div class="admin-section-heading"><div><h3>${title}</h3><p class="inline-note">Click an entry or <b>EDIT</b> to edit existing content.${['hero','leaks','screens'].includes(key)?' Use the ⋮⋮ handle to drag and change the order.':''}</p></div></div>
        <div class="admin-list">${list.map(x=>adminRow(x[imgKey],x.title||x.eyebrow||x.label,subtitle(x),key,x.id)).join('')}</div>
      </section>
      <section class="admin-section editor-section">
        <h3>${editId!=null?'Edit Selected':'Create New'}</h3>
        ${editId!=null?'<div class="editing-badge">EDIT MODE · EXISTING CONTENT</div>':''}
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
        {name:'mediaType',label:'SLIDE MEDIA TYPE',type:'select',options:['image','video'],default:'image'},
        {name:'duration',label:'SLIDE DURATION (SECONDS)',type:'number',default:'7'},
        {name:'cta',label:'BUTTON LABEL',default:'EXPLORE NOW'},
        {name:'href',label:'BUTTON LINK',default:'#news'},
        {name:'image',label:'POSTER / BACKGROUND IMAGE PATH OR URL',default:'assets/gta-6-trailer-2.jpg',full:true},
        {name:'video',label:'VIDEO URL (STREAMABLE / YOUTUBE / VIMEO / MP4 / WEBM / EMBED URL)',default:'',full:true},
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
    section.innerHTML = `<h3>Live Feed Import</h3><p class="inline-note">Import current items from Reddit and X directly into your manual news list.</p><div class="inline-actions"><button class="solid-btn" id="importFeedsBtn">IMPORT LIVE FEEDS</button></div>`;
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

  async function renderComments(){
    $('#adminContent').innerHTML=`
      <section class="admin-section">
        <div class="admin-section-heading"><div><h3>Guest Comments</h3><p class="inline-note">Review guest comments and replies posted below videos and screenshots. Deleting a parent comment also removes its replies.</p></div><button class="ghost-btn" id="refreshComments">REFRESH</button></div>
        <div class="comment-admin-filters"><button class="chip active" data-comment-filter="all">ALL</button><button class="chip" data-comment-filter="video">VIDEOS</button><button class="chip" data-comment-filter="screenshot">SCREENSHOTS</button></div>
        <div id="adminCommentsList" class="admin-comments-list"><div class="inline-note">Loading comments…</div></div>
      </section>`;
    $('#refreshComments').onclick=renderComments;
    let items=[];
    try{
      const r=await fetch('/api/admin/comments',{credentials:'same-origin',cache:'no-store'});
      const d=await r.json();
      if(!r.ok)throw new Error(d?.error||`HTTP ${r.status}`);
      items=Array.isArray(d.items)?d.items:[];
    }catch(e){
      $('#adminCommentsList').innerHTML='<div class="codebox">Comments could not be loaded. Check the admin session and Cloudflare Functions.</div>';
      return;
    }
    function contentTitle(c){
      const list=c.media_type==='video'?draft.leaks:draft.screenshots;
      return list.find(x=>String(x.id)===String(c.content_id))?.title || c.content_id;
    }
    function paint(filter='all'){
      const filtered=filter==='all'?items:items.filter(x=>x.media_type===filter);
      $('#adminCommentsList').innerHTML=filtered.length?filtered.map(c=>`
        <article class="admin-comment-row" data-comment-type="${window.SIXWORLD.escapeHtml(c.media_type)}">
          <div class="admin-comment-top"><div><span class="comment-type-badge ${c.media_type}">${c.media_type==='video'?'VIDEO':'SCREENSHOT'}</span><b>${window.SIXWORLD.escapeHtml(contentTitle(c))}</b></div><button class="admin-delete-comment" data-comment-delete="${c.id}">DELETE</button></div>
          <div class="admin-comment-meta"><b>${window.SIXWORLD.escapeHtml(c.nickname)}</b><span>${window.SIXWORLD.escapeHtml(c.created_at||'')}</span>${c.parent_id?`<span>Reply to #${c.parent_id}</span>`:''}</div>
          <p>${window.SIXWORLD.escapeHtml(c.body).replace(/\n/g,'<br>')}</p>
        </article>`).join(''):'<div class="no-admin-comments">No comments in this filter.</div>';
      $$('[data-comment-delete]','#adminCommentsList').forEach(btn=>btn.onclick=async()=>{
        if(!confirm('Delete this comment and all of its replies?'))return;
        btn.disabled=true;btn.textContent='DELETING…';
        try{
          const r=await fetch(`/api/admin/comments?id=${encodeURIComponent(btn.dataset.commentDelete)}`,{method:'DELETE',credentials:'same-origin'});
          const d=await r.json().catch(()=>({}));
          if(!r.ok)throw new Error(d?.error||`HTTP ${r.status}`);
          window.SIXWORLD.toast('Comment deleted.');
          await renderComments();
        }catch(e){window.SIXWORLD.toast('Comment delete failed.');btn.disabled=false;btn.textContent='DELETE';}
      });
    }
    $$('.comment-admin-filters [data-comment-filter]').forEach(btn=>btn.onclick=()=>{
      $$('.comment-admin-filters [data-comment-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');paint(btn.dataset.commentFilter);
    });
    paint('all');
  }

  function renderMap(){
    const blips=draft.map.blips||[];
    const categoryObjects=(draft.map.categories||[]);
    const categories=categoryObjects.map(x=>x.key);
    if(adminMapFilter!=='all' && !categories.includes(adminMapFilter)) adminMapFilter='all';
    const visibleBlips=adminMapFilter==='all' ? blips : blips.filter(b=>String(b.category)===String(adminMapFilter));
    let selected=visibleBlips.find(x=>String(x.id)===String(selectedBlipId))||visibleBlips[0]||null;
    selectedBlipId=selected?.id||null;
    const tagValue=Array.isArray(selected?.tags)?selected.tags.join(', '):(selected?.tags||'');
    const adminFilterItems=[
      {key:'all',label:'ALL',count:blips.length},
      ...categoryObjects.map(c=>({key:c.key,label:String(c.label||c.key).toUpperCase(),count:blips.filter(b=>String(b.category)===String(c.key)).length}))
    ];
    $('#adminContent').innerHTML=`
      <section class="admin-section">
        <h3>Map Setup</h3>
        <p class="inline-note">Zoom with the mouse wheel or + / −. Drag the map to move it. A short click on an empty position creates a new location.</p>
        <div class="community-map-import">
          <div>
            <b>GTA VI MAPPING COMMUNITY LOCATIONS</b>
            <small>Around 60 approximate districts, landmarks, shops, safehouses, activities, transport and secret locations. Every imported location remains fully editable.</small>
          </div>
          <div class="inline-actions">
            <button class="solid-btn" id="importCommunityMap">IMPORT / RESTORE</button>
            <button class="ghost-btn" id="toggleCommunityMap">${draft.map.communityMapping?.enabled===false?'ENABLE':'DISABLE'} AUTO MAP</button>
          </div>
        </div>
        <div class="admin-form" style="margin-top:14px">
          <div class="admin-field"><label>MAP IMAGE PATH / URL</label><input id="mapImageInput" value="${window.SIXWORLD.escapeHtml(draft.map.image||'assets/InteractiveMap/GTA6MAP.png')}"></div>
          <div class="admin-field"><label>LEONIDA LOGO PATH / URL</label><input id="mapLogoInput" value="${window.SIXWORLD.escapeHtml(draft.map.logo||'assets/logo/Leonidaloga.png')}"></div>
          <div class="admin-field"><label>MAP INTRO LABEL</label><input id="mapIntroInput" value="${window.SIXWORLD.escapeHtml(draft.map.introLabel||'VICE CITY & BEYOND')}"></div>
          <div class="admin-field"><label>LAST UPDATED</label><input id="mapUpdatedInput" value="${window.SIXWORLD.escapeHtml(draft.map.updatedDate||'May 12, 2025')}"></div>
        </div>
        <div class="admin-map-filter-panel">
          <div class="admin-map-filter-head">
            <div>
              <b>BLIP FILTER</b>
              <small>Show only one category while positioning markers. This filter only changes the Admin preview — it does not delete or hide locations on the public map.</small>
            </div>
            <span class="admin-map-filter-count">${visibleBlips.length} / ${blips.length} VISIBLE</span>
          </div>
          <div class="admin-map-filter-chips">
            ${adminFilterItems.map(f=>`
              <button type="button" class="admin-map-filter-chip ${adminMapFilter===f.key?'active':''}" data-admin-map-filter="${window.SIXWORLD.escapeHtml(f.key)}">
                ${f.key==='all'?'<span class="admin-filter-all-icon">◎</span>':adminMapIconSvg(f.key)}
                <span>${window.SIXWORLD.escapeHtml(f.label)}</span>
                <em>${f.count}</em>
              </button>`).join('')}
          </div>
        </div>
        <div class="map-editor-layout" style="margin-top:14px">
          <div>
            <div class="map-editor-preview" id="mapEditPreview">
              <div class="admin-map-stage" id="adminMapStage">
                <img src="${window.SIXWORLD.escapeHtml(draft.map.image)}" alt="" draggable="false">
                <div class="admin-map-blips">${visibleBlips.map(b=>`<button class="edit-blip ${b.category||'landmark'} ${String(selected?.id)===String(b.id)?'selected':''}" data-id="${window.SIXWORLD.escapeHtml(b.id)}" style="left:${b.x}%;top:${b.y}%">${adminMapIconSvg(b.category)}</button>`).join('')}</div>
              </div>
              <div class="admin-map-toolbar" aria-label="Admin map tools">
                <button id="adminZoomIn" type="button" title="Zoom in">+</button>
                <button id="adminZoomOut" type="button" title="Zoom out">−</button>
                <button id="adminZoomReset" type="button" title="Reset map">⌖</button>
              </div>
              <div class="admin-map-zoom-label" id="adminMapZoomLabel">100%</div>
            </div>
            <div class="inline-actions"><button class="solid-btn" id="newBlip">NEW LOCATION</button><button class="ghost-btn" id="deleteBlip">DELETE SELECTED</button><button class="ghost-btn" id="exportMapJson">COPY MAP JSON</button></div>
            <p class="inline-note admin-map-help">Markers and icons are anchored directly to the map and scale proportionally while zooming, keeping their exact positions.</p>
            <div class="blip-list">${visibleBlips.length?visibleBlips.map(b=>`<div class="blip-item ${String(selected?.id)===String(b.id)?'active':''}" data-pick-blip="${window.SIXWORLD.escapeHtml(b.id)}"><span class="blip-pill">${adminMapIconSvg(b.category)}</span><div><b>${window.SIXWORLD.escapeHtml(b.label||'Untitled')}</b><div class="inline-note">${window.SIXWORLD.escapeHtml(b.category||'landmark')} · ${b.x}% / ${b.y}%</div></div></div>`).join(''):`<div class="admin-map-empty-filter">No ${window.SIXWORLD.escapeHtml(adminMapFilter.toUpperCase())} markers yet.</div>`}</div>
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
            <div class="admin-field"><label>MAP STATUS</label><select id="bStatus"><option value="approximate" ${(selected?.status||'approximate')==='approximate'?'selected':''}>approximate</option><option value="confirmed" ${selected?.status==='confirmed'?'selected':''}>confirmed</option><option value="community" ${selected?.status==='community'?'selected':''}>community</option></select></div>
            <div class="admin-field full"><label>SOURCE / RESEARCH NOTE</label><input id="bSource" value="${window.SIXWORLD.escapeHtml(selected?.source||'')}"></div>
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
      // Keep Admin markers readable without letting them become enormous at 250–400% zoom.
      // They still grow with the map, but at a slower visual rate.
      const compensation=1/Math.sqrt(Math.max(.75,adminMapScale));
      $$('.edit-blip',stage).forEach(el=>el.style.setProperty('--admin-blip-compensation',compensation.toFixed(4)));
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

    $$('[data-admin-map-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      adminMapFilter=btn.dataset.adminMapFilter||'all';
      const first=adminMapFilter==='all'
        ? draft.map.blips[0]
        : draft.map.blips.find(b=>String(b.category)===String(adminMapFilter));
      selectedBlipId=first?.id||null;
      renderMap();
    }));

    const currentBlip=()=>draft.map.blips.find(x=>String(x.id)===String(selectedBlipId))||null;
    function syncCurrentBlip(){
      const b=currentBlip();if(!b)return;
      b.label=$('#bLabel').value;
      const previousCategory=b.category;
      b.category=$('#bCat').value;b.symbol=$('#bSymbol').value;b.image=$('#bImage').value;
      if(adminMapFilter!=='all' && previousCategory!==b.category) adminMapFilter=b.category;
      b.region=$('#bRegion').value;b.district=$('#bDistrict').value;b.poiCount=+$('#bPoiCount').value||0;b.discovered=$('#bDiscovered').value;
      b.tags=$('#bTags').value.split(',').map(x=>x.trim()).filter(Boolean);b.description=$('#bDesc').value;b.link=$('#bLink').value;
      b.x=+$('#bX').value;b.y=+$('#bY').value;b.featured=$('#bFeatured').value==='true';
      b.status=$('#bStatus')?.value||b.status||'approximate';b.source=$('#bSource')?.value||b.source||'';
      const el=$(`.edit-blip[data-id="${CSS.escape(String(b.id))}"]`);if(el){el.innerHTML=adminMapIconSvg(b.category);el.style.left=b.x+'%';el.style.top=b.y+'%';el.className=`edit-blip ${b.category} selected`}
      const row=$(`.blip-item[data-pick-blip="${CSS.escape(String(b.id))}"]`);if(row){row.querySelector('b').textContent=b.label;const n=row.querySelector('.inline-note');if(n)n.textContent=`${b.category} · ${b.x}% / ${b.y}%`;}
    }
    ['bLabel','bSymbol','bImage','bRegion','bDistrict','bPoiCount','bDiscovered','bTags','bDesc','bLink','bX','bY','bFeatured','bStatus','bSource'].forEach(id=>$('#'+id)?.addEventListener('input',syncCurrentBlip));
    $('#bCat')?.addEventListener('change',()=>{
      syncCurrentBlip();
      renderMap();
    });
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
      const newCategory=adminMapFilter==='all'?'landmark':adminMapFilter;
      const b={id:uid('loc'),x,y,label:'New Location',category:newCategory,symbol:'★',image:'assets/nighttimepink.webp',region:'Leonida',district:'',poiCount:0,discovered:'',tags:[newCategory.toUpperCase()],description:'',link:'#map',featured:false};
      draft.map.blips.push(b);selectedBlipId=b.id;renderMap();
    });

    $('#newBlip').onclick=()=>{
      const newCategory=adminMapFilter==='all'?'landmark':adminMapFilter;
      const b={id:uid('loc'),x:50,y:50,label:'New Location',category:newCategory,symbol:'★',image:'assets/nighttimepink.webp',region:'Leonida',district:'',poiCount:0,discovered:'',tags:[newCategory.toUpperCase()],description:'',link:'#map',featured:false};
      draft.map.blips.push(b);selectedBlipId=b.id;renderMap();
    };
    $('#importCommunityMap')?.addEventListener('click',async()=>{
      try{
        const r=await fetch('data/community-map-locations.json',{cache:'no-store'});
        if(!r.ok) throw new Error('dataset unavailable');
        const data=await r.json();
        const incoming=Array.isArray(data.locations)?data.locations:[];
        draft.map.communityMapping ||= {enabled:true,version:1,excludedIds:[]};
        draft.map.communityMapping.enabled=true;
        draft.map.communityMapping.excludedIds=[];
        draft.map.communityMapping.version=Number(data.version||1);
        draft.map.communityMapping.source=data.source||'GTA VI Mapping Community / State of Leonida';
        const existingIds=new Set((draft.map.blips||[]).map(x=>String(x.id)));
        const existingLabels=new Set((draft.map.blips||[]).map(x=>String(x.label||'').trim().toLowerCase()).filter(Boolean));
        let added=0;
        for(const loc of incoming){
          const id=String(loc.id||'');
          const label=String(loc.label||'').trim().toLowerCase();
          if(!id || existingIds.has(id) || (label && existingLabels.has(label))) continue;
          draft.map.blips.push({...loc});
          existingIds.add(id); if(label) existingLabels.add(label); added++;
        }
        adminMapFilter='all';
        selectedBlipId=draft.map.blips.find(x=>x.sourceSet==='stateofleonida-community')?.id||draft.map.blips[0]?.id||null;
        await saveDraft(`Community map imported · ${added} new locations published.`);
        renderMap();
      }catch(e){
        window.SIXWORLD.toast('Community map import failed.');
      }
    });
    $('#toggleCommunityMap')?.addEventListener('click',async()=>{
      draft.map.communityMapping ||= {enabled:true,version:1,excludedIds:[]};
      draft.map.communityMapping.enabled=!draft.map.communityMapping.enabled;
      await saveDraft(draft.map.communityMapping.enabled?'Community auto map enabled.':'Community auto map disabled.');
      renderMap();
    });
    $('#deleteBlip').onclick=async()=>{
      if(!selectedBlipId)return;
      const deleting=draft.map.blips.find(x=>String(x.id)===String(selectedBlipId));
      if(deleting?.sourceSet==='stateofleonida-community'){
        draft.map.communityMapping ||= {enabled:true,version:1,excludedIds:[]};
        draft.map.communityMapping.excludedIds ||= [];
        if(!draft.map.communityMapping.excludedIds.includes(String(deleting.id))) draft.map.communityMapping.excludedIds.push(String(deleting.id));
      }
      draft.map.blips=draft.map.blips.filter(x=>String(x.id)!==String(selectedBlipId));
      selectedBlipId=draft.map.blips[0]?.id||null;
      renderMap();
      await saveDraft('Location deleted & published.');
    };
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
        <div class="admin-field full"><label>WEBSITE BACKGROUND IMAGE PATH / URL</label><input id="setBackground" value="${window.SIXWORLD.escapeHtml(s.backgroundImage||'assets/site-background.png')}"></div>
        <div class="admin-field"><label>DEFAULT PUBLIC LANGUAGE</label><select id="setDefaultLanguage"><option value="en" ${(s.defaultLanguage||'en')==='en'?'selected':''}>English</option><option value="de" ${s.defaultLanguage==='de'?'selected':''}>Deutsch</option></select></div>
      </div><div class="codebox" style="margin-top:16px">The background can use an asset path such as <b>assets/site-background.png</b> or a direct image URL. The public language switch in the header always lets visitors choose English or German.</div></section>
      <section class="admin-section"><h3>Feed Configuration</h3><div class="admin-form">
        <div class="admin-field"><label>LIVE FEEDS ENABLED</label><select id="feedEnabled"><option value="true" ${(f.enabled!==false)?'selected':''}>true</option><option value="false" ${(f.enabled===false)?'selected':''}>false</option></select></div>
        <div class="admin-field full"><label>REDDIT FEEDS (one per line or comma-separated)</label><textarea id="feedSubreddits" rows="4">${window.SIXWORLD.escapeHtml((Array.isArray(f.subreddits)&&f.subreddits.length?f.subreddits:['GTA6unmoderated','GTA6_NEW']).join('\n'))}</textarea></div>
        <div class="admin-field"><label>X USERNAME</label><input id="feedXUser" value="${window.SIXWORLD.escapeHtml(f.xUser||'RockstarGames')}"></div>
        <div class="admin-field"><label>MAX LIVE ITEMS</label><input id="feedMaxItems" type="number" min="1" max="30" value="${window.SIXWORLD.escapeHtml(String(f.maxItems||10))}"></div>
      </div><div class="codebox" style="margin-top:16px"><b>Active Reddit feeds:</b> r/GTA6unmoderated and r/GTA6_NEW. New posts are loaded automatically on the News page. Add or remove subreddits here at any time. The serverless feed is cached briefly to avoid unnecessary Reddit requests.</div></section>
      <section class="admin-section">
        <div class="admin-section-heading">
          <div>
            <h3>Backups & Static Fallback</h3>
            <p class="inline-note">D1 remains the live source of truth. SIXWORLD can additionally keep a browser-local snapshot and synchronize the current D1 document to <b>data/content.json</b> in GitHub.</p>
          </div>
          <span class="backup-status-pill" id="githubBackupStatus">CHECKING…</span>
        </div>
        <div class="admin-form">
          <div class="admin-field"><label>AUTO GITHUB BACKUP AFTER SAVES</label><select id="githubAutoBackup"><option value="true" ${s.githubAutoBackup!==false?'selected':''}>true</option><option value="false" ${s.githubAutoBackup===false?'selected':''}>false</option></select></div>
          <div class="admin-field full">
            <label>BACKUP TARGET</label>
            <div class="codebox" id="githubBackupTarget">Checking GitHub backup configuration…</div>
          </div>
        </div>
        <div class="backup-actions">
          <button class="solid-btn" type="button" id="githubBackupNow">BACKUP TO GITHUB NOW</button>
          <button class="ghost-btn" type="button" id="downloadContentBackup">DOWNLOAD CONTENT.JSON BACKUP</button>
        </div>
        <div class="codebox backup-explainer">
          <b>Recovery layers:</b><br>
          1. D1 = live content database.<br>
          2. Browser snapshot = automatically updated on this admin device after every successful save.<br>
          3. GitHub <b>data/content.json</b> = static fallback for visitors if the Cloudflare API becomes unavailable.<br>
          4. Download button = a physical JSON backup you can keep on your PC.
        </div>
      </section>`;
    ['setName','setSearch','setAccent','setAccent2','setBackground','setDefaultLanguage','githubAutoBackup'].forEach(id=>$('#'+id).oninput=()=>{
      draft.settings={
        ...draft.settings,
        siteName:$('#setName').value,
        searchPlaceholder:$('#setSearch').value,
        accent:$('#setAccent').value,
        accent2:$('#setAccent2').value,
        backgroundImage:$('#setBackground').value,
        defaultLanguage:$('#setDefaultLanguage').value,
        githubAutoBackup:$('#githubAutoBackup')?.value!=='false'
      };
    });
    ['feedEnabled','feedSubreddits','feedXUser','feedMaxItems'].forEach(id=>$('#'+id).oninput=()=>{
      const subreddits=$('#feedSubreddits').value.split(/[\n,]+/).map(x=>x.trim().replace(/^r\//i,'')).filter(Boolean);
      draft.feeds={enabled:$('#feedEnabled').value==='true',subreddits:subreddits.length?subreddits:['GTA6unmoderated','GTA6_NEW'],xUser:$('#feedXUser').value,maxItems:+$('#feedMaxItems').value||10};
    });

    $('#downloadContentBackup').onclick=downloadContentBackup;
    $('#githubBackupNow').onclick=async()=>{
      const btn=$('#githubBackupNow');
      const old=btn.textContent;
      btn.disabled=true;btn.textContent='BACKING UP…';
      const result=await backupDraftToGithub({silent:false});
      btn.disabled=false;btn.textContent=old;
      if(result?.ok) refreshGithubBackupStatus();
    };

    async function refreshGithubBackupStatus(){
      const status=$('#githubBackupStatus');
      const target=$('#githubBackupTarget');
      if(!status||!target)return;
      const info=await getGithubBackupStatus();
      if(!window.SIXWORLD.backend){
        status.textContent='LOCAL PREVIEW';
        status.className='backup-status-pill neutral';
        target.innerHTML='GitHub synchronization becomes available after deployment and admin login.';
        return;
      }
      if(info?.configured){
        status.textContent=info.ok===false?'GITHUB ERROR':'GITHUB READY';
        status.className=`backup-status-pill ${info.ok===false?'error':'ready'}`;
        target.innerHTML=`<b>${window.SIXWORLD.escapeHtml(info.repo||'')}</b> · branch <b>${window.SIXWORLD.escapeHtml(info.branch||'main')}</b> · <b>${window.SIXWORLD.escapeHtml(info.path||'data/content.json')}</b>${info.error?`<br>${window.SIXWORLD.escapeHtml(info.error)}`:''}`;
      }else{
        status.textContent='TOKEN REQUIRED';
        status.className='backup-status-pill warning';
        target.innerHTML='Add a Cloudflare secret named <b>GITHUB_TOKEN</b>. Recommended: a fine-grained GitHub token restricted to the SixWorld repository with <b>Contents: Read and write</b>.';
      }
    }
    refreshGithubBackupStatus();
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
      <section class="admin-section"><h3>How It Works</h3><div class="access-box"><div class="codebox">The small hidden trigger appears only on the Map page. Clicking it opens the login window. Local preview uses the demo credentials configured above; after deployment the included server-side API handles authentication.</div></div></section>`;
    ['accText','accPage','accUser','accPass'].forEach(id=>$('#'+id).oninput=()=>{
      draft.access={secretText:$('#accText').value,secretPage:$('#accPage').value,demoUser:$('#accUser').value,demoPass:$('#accPass').value};
    });
  }
})();
