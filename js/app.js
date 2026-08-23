(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const escapeHtml = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const FALLBACK_KEY = 'sixworld_content_v3';
  const app = window.SIXWORLD = { content:null, backend:false, escapeHtml, FALLBACK_KEY, toast:null, liveFeedItems:[], viewCache:new Map(), community:{active:null,items:[],replyTo:null} };

  async function loadContent(){
    try{
      const r = await fetch('/api/content',{cache:'no-store'});
      if(r.ok){ app.backend = true; return await r.json(); }
    }catch(e){}
    const local = localStorage.getItem(FALLBACK_KEY) || localStorage.getItem('sixworld_content_v2') || localStorage.getItem('sixworld_content_v1');
    if(local){ try{return JSON.parse(local)}catch(e){} }
    const r = await fetch('data/content.json',{cache:'no-store'});
    return r.json();
  }

  function normalizeContent(){
    app.content ||= {};
    app.content.settings ||= {};
    app.content.settings.siteName ||= 'SIXWORLD';
    app.content.settings.searchPlaceholder ||= 'Search...';
    app.content.settings.accent ||= '#ff4fa3';
    app.content.settings.accent2 ||= '#42e6ee';
    app.content.settings.backgroundImage ||= 'assets/site-background.png';
    app.content.settings.defaultLanguage ||= 'en';
    app.content.access ||= {secretText:'sw_6.0.22',secretPage:'map',demoUser:'admin',demoPass:'sixworld'};
    app.content.hero ||= [];
    app.content.hero.forEach(slide=>{
      slide.mediaType ||= slide.video ? 'video' : 'image';
      slide.duration = Math.max(2, Math.min(60, Number(slide.duration)||7));
      slide.video ||= '';
    });
    app.content.leaks ||= [];
    app.content.screenshots ||= [];
    app.content.news ||= [];
    app.content.feeds ||= {};
    app.content.feeds.enabled = app.content.feeds.enabled !== false;
    app.content.feeds.subreddits = Array.isArray(app.content.feeds.subreddits) && app.content.feeds.subreddits.length
      ? app.content.feeds.subreddits
      : ['GTA6unmoderated','GTA6_NEW'];
    app.content.feeds.xUser ||= 'RockstarGames';
    app.content.feeds.maxItems = Math.max(1, Number(app.content.feeds.maxItems)||10);
    delete app.content.feeds.subreddit;

    // Asset names were shortened in v9. Migrate older D1 content automatically.
    const legacyPaths={
      'assets/gta-6-everything-we-know-what-to-expect-9e97577643.jpg':'assets/gtaimage6.jpg',
      'assets/GTA_6_New_Release_Date_Explained_d65d2837da.png':'assets/gtaimage3.png',
      'assets/GTA-6-artwork-characters-larger.jpg':'assets/gtaimage4.jpg',
      'assets/pngs/gta_vi_6_characters_transparent_png_by_wallpaper_background_dlqugsx-pre.png':'assets/pngs/gta6characters.png',
      'assets/pngs/gta-vi-3d-v0-kriobc9v092e1.webp':'assets/pngs/gtavilogocustom.webp'
    };
    const migratePath=v=>legacyPaths[v]||v;
    app.content.hero.forEach(x=>x.image=migratePath(x.image));
    app.content.leaks.forEach(x=>x.thumb=migratePath(x.thumb));
    app.content.screenshots.forEach(x=>x.image=migratePath(x.image));
    app.content.news.forEach(x=>x.image=migratePath(x.image));

    app.content.map ||= {};
    const m=app.content.map;
    m.image='assets/InteractiveMap/GTA6MAP.png';
    m.logo ||= 'assets/logo/Leonidaloga.png';
    m.introLabel ||= 'VICE CITY & BEYOND';
    m.updatedDate ||= 'May 12, 2025';
    m.communityMapping ||= {};
    m.communityMapping.enabled = m.communityMapping.enabled !== false;
    m.communityMapping.version = Number(m.communityMapping.version || 1);
    m.communityMapping.excludedIds = Array.isArray(m.communityMapping.excludedIds) ? m.communityMapping.excludedIds : [];
    const newCategories=[
      {key:'district',label:'DISTRICTS',legend:'Districts',short:'▦',icon:'▦'},
      {key:'landmark',label:'LANDMARKS',legend:'Landmarks',short:'★',icon:'☆'},
      {key:'activity',label:'ACTIVITIES',legend:'Activities',short:'⚑',icon:'⚑'},
      {key:'shop',label:'SHOPS',legend:'Shops',short:'▣',icon:'▣'},
      {key:'safehouse',label:'SAFEHOUSES',legend:'Safehouses',short:'⌂',icon:'⌂'},
      {key:'secret',label:'SECRETS',legend:'Secrets',short:'◇',icon:'◇'},
      {key:'transport',label:'TRANSPORT',legend:'Transport',short:'▰',icon:'▰'}
    ];
    const keys=new Set((m.categories||[]).map(x=>x.key));
    if(!keys.has('landmark') || !keys.has('activity') || !keys.has('shop')) m.categories=newCategories;
    else m.categories=newCategories.map(def=>({...def,...((m.categories||[]).find(x=>x.key===def.key)||{})}));

    // Preserve exactly the locations saved in D1. Earlier versions automatically
    // re-added demo locations after an admin deleted them; that made deleted blips
    // and Recently Discovered cards appear again. Only migrate existing locations.
    const oldMap={city:'district',poi:'landmark',leak:'secret'};
    m.blips=Array.isArray(m.blips) ? m.blips.map(b=>({
      ...b,
      category:oldMap[b.category]||b.category||'landmark',
      image:migratePath(b.image||'assets/nighttimepink.webp'),
      region:b.region||'Leonida',
      district:b.district||'',
      tags:Array.isArray(b.tags)?b.tags:[],
      poiCount:b.poiCount??0,
      discovered:b.discovered||'',
      description:b.description||''
    })) : [];
  }


  async function mergeCommunityMapLocations(){
    const m=app.content?.map;
    if(!m || m.communityMapping?.enabled===false) return;
    try{
      const r=await fetch('data/community-map-locations.json',{cache:'no-store'});
      if(!r.ok) return;
      const data=await r.json();
      const incoming=Array.isArray(data.locations)?data.locations:[];
      const excluded=new Set((m.communityMapping?.excludedIds||[]).map(String));
      const existingIds=new Set((m.blips||[]).map(x=>String(x.id)));
      const existingLabels=new Set((m.blips||[]).map(x=>String(x.label||'').trim().toLowerCase()).filter(Boolean));
      for(const loc of incoming){
        const id=String(loc.id||'');
        const label=String(loc.label||'').trim().toLowerCase();
        if(!id || excluded.has(id) || existingIds.has(id) || (label && existingLabels.has(label))) continue;
        m.blips.push({...loc});
        existingIds.add(id);
        if(label) existingLabels.add(label);
      }
      m.communityMapping.version=Number(data.version||1);
      m.communityMapping.source=data.source||'GTA VI Mapping Community / State of Leonida';
      m.communityMapping.note=data.note||'';
    }catch(e){}
  }

  const I18N={
    en:{
      'nav.home':'HOME','nav.leaks':'LEAKS','nav.screenshots':'SCREENSHOTS','nav.news':'NEWS','nav.map':'MAP',
      'home.leaks':'LEAKS','home.screenshots':'SCREENSHOTS','home.news':'LATEST NEWS','home.map':'INTERACTIVE MAP','home.viewAll':'VIEW ALL','home.explore':'EXPLORE',
      'leaks.kicker':'ARCHIVE','leaks.title':'LEAKS','leaks.description':'Gameplay clips, community discoveries and embedded videos from Streamable, Drive, YouTube or direct links.','leaks.videos':'VIDEOS',
      'screens.kicker':'MEDIA','screens.title':'SCREENSHOTS','screens.description':'Asset-based images and external screenshot links in a clean gallery.','screens.images':'IMAGES',
      'news.kicker':'LIVE FEED','news.title':'LATEST NEWS','news.description':'Rockstar, X and selected Reddit posts can be loaded automatically or managed manually.','news.refresh':'REFRESH FEEDS','news.sources':'SOURCES','news.sourceNote':'Serverless endpoints provide live feed data after deployment. Manually managed news always remains available.',
      'map.title':'Map','map.subtitle':'Explore Leonida','map.filters':'Filters','map.filterTitle':'MAP FILTERS','map.resetFilters':'RESET FILTERS','map.selectedLocation':'SELECTED LOCATION','map.legend':'MAP LEGEND','map.hide':'Hide ⌃','map.data':'MAP DATA (FAN-MADE)','map.research':'LOCATION RESEARCH: GTA VI MAPPING COMMUNITY / STATE OF LEONIDA',
      'map.district':'DISTRICTS','map.landmark':'LANDMARKS','map.activity':'ACTIVITIES','map.shop':'SHOPS','map.safehouse':'SAFEHOUSES','map.secret':'SECRETS','map.transport':'TRANSPORT',
      'map.region':'REGION','map.districtFact':'DISTRICT','map.poi':'POINTS OF INTEREST','map.discovered':'DISCOVERED','map.recent':'RECENTLY DISCOVERED','map.viewAll':'VIEW ALL →',
      'footer.project':'© 2026 SIXWORLD — FAN PROJECT','footer.disclaimer':'NOT AFFILIATED WITH ROCKSTAR GAMES OR TAKE-TWO INTERACTIVE.',
      'login.restricted':'RESTRICTED','login.authorized':'Authorized access only.','login.access':'ACCESS PANEL','login.hint':'Secure backend login when deployed. Local preview uses demo credentials.',
      'search.placeholder':'Search...','menu.open':'Open menu','menu.close':'Close menu','profile.notice':'Community profiles can be connected as a later module.',
      'community.views':'views','community.comments':'COMMENTS','community.guestTitle':'Join as a guest','community.guestHelp':'Choose a nickname to comment. No account or password is required.','community.nickname':'Nickname','community.useNickname':'USE NICKNAME','community.commentingAs':'Commenting as','community.change':'CHANGE','community.placeholder':'Write a comment...','community.replyPlaceholder':'Write a reply...','community.post':'POST COMMENT','community.reply':'REPLY','community.cancel':'CANCEL','community.noComments':'No comments yet. Be the first to comment.','community.loading':'Loading comments...','community.reserved':'This nickname is reserved.','community.nickLength':'Nickname must be 2–24 characters.','community.postFailed':'Comment could not be posted.'
    },
    de:{
      'nav.home':'START','nav.leaks':'LEAKS','nav.screenshots':'SCREENSHOTS','nav.news':'NEWS','nav.map':'KARTE',
      'home.leaks':'LEAKS','home.screenshots':'SCREENSHOTS','home.news':'AKTUELLE NEWS','home.map':'INTERAKTIVE KARTE','home.viewAll':'ALLE ANZEIGEN','home.explore':'ÖFFNEN',
      'leaks.kicker':'ARCHIV','leaks.title':'LEAKS','leaks.description':'Gameplay-Clips, Community-Funde und eingebettete Videos von Streamable, Drive, YouTube oder Direktlinks.','leaks.videos':'VIDEOS',
      'screens.kicker':'MEDIEN','screens.title':'SCREENSHOTS','screens.description':'Bilder aus den Assets und externe Screenshot-Links in einer übersichtlichen Galerie.','screens.images':'BILDER',
      'news.kicker':'LIVE-FEED','news.title':'AKTUELLE NEWS','news.description':'Rockstar-, X- und ausgewählte Reddit-Posts können automatisch geladen oder manuell verwaltet werden.','news.refresh':'FEEDS AKTUALISIEREN','news.sources':'QUELLEN','news.sourceNote':'Nach dem Deployment liefern die Serverless-Endpunkte Live-Feed-Daten. Manuell gepflegte News bleiben zusätzlich immer verfügbar.',
      'map.title':'Karte','map.subtitle':'Leonida erkunden','map.filters':'Filter','map.filterTitle':'KARTENFILTER','map.resetFilters':'FILTER ZURÜCKSETZEN','map.selectedLocation':'AUSGEWÄHLTER ORT','map.legend':'KARTENLEGENDE','map.hide':'Ausblenden ⌃','map.data':'KARTENDATEN (FAN-MADE)','map.research':'ORTSRECHERCHE: GTA VI MAPPING COMMUNITY / STATE OF LEONIDA',
      'map.district':'BEZIRKE','map.landmark':'SEHENSWÜRDIGKEITEN','map.activity':'AKTIVITÄTEN','map.shop':'SHOPS','map.safehouse':'SAFEHOUSES','map.secret':'GEHEIMNISSE','map.transport':'TRANSPORT',
      'map.region':'REGION','map.districtFact':'BEZIRK','map.poi':'SEHENSWÜRDIGKEITEN','map.discovered':'ENTDECKT','map.recent':'KÜRZLICH ENTDECKT','map.viewAll':'ALLE ANZEIGEN →',
      'footer.project':'© 2026 SIXWORLD — FANPROJEKT','footer.disclaimer':'NICHT MIT ROCKSTAR GAMES ODER TAKE-TWO INTERACTIVE VERBUNDEN.',
      'login.restricted':'GESCHÜTZT','login.authorized':'Nur für autorisierte Zugriffe.','login.access':'ADMIN PANEL ÖFFNEN','login.hint':'Sicherer Backend-Login nach dem Deployment. Die lokale Vorschau verwendet Demo-Zugangsdaten.',
      'search.placeholder':'Suchen...','menu.open':'Menü öffnen','menu.close':'Menü schließen','profile.notice':'Community-Profile können später als eigenes Modul ergänzt werden.',
      'community.views':'Aufrufe','community.comments':'KOMMENTARE','community.guestTitle':'Als Gast teilnehmen','community.guestHelp':'Wähle einen Nicknamen zum Kommentieren. Kein Account und kein Passwort erforderlich.','community.nickname':'Nickname','community.useNickname':'NICKNAME VERWENDEN','community.commentingAs':'Kommentieren als','community.change':'ÄNDERN','community.placeholder':'Kommentar schreiben...','community.replyPlaceholder':'Antwort schreiben...','community.post':'KOMMENTIEREN','community.reply':'ANTWORTEN','community.cancel':'ABBRECHEN','community.noComments':'Noch keine Kommentare. Sei der Erste.','community.loading':'Kommentare werden geladen...','community.reserved':'Dieser Nickname ist reserviert.','community.nickLength':'Der Nickname muss 2–24 Zeichen lang sein.','community.postFailed':'Kommentar konnte nicht veröffentlicht werden.'
    }
  };
  app.language=localStorage.getItem('sixworld_language')||'en';
  function t(key){return I18N[app.language]?.[key]||I18N.en[key]||key;}
  function translateContentText(value){
    if(app.language!=='de') return value||'';
    const known={
      'Your ultimate hub for GTA VI news, leaks, screenshots and more.':'Deine zentrale Anlaufstelle für GTA VI News, Leaks, Screenshots und mehr.',
      'Watch the newest community videos, gameplay analysis and Vice City discoveries in one place.':'Sieh dir die neuesten Community-Videos, Gameplay-Analysen und Vice-City-Entdeckungen an einem Ort an.',
      'Track landmarks, activities, secrets and discoveries across Vice City and beyond.':'Verfolge Sehenswürdigkeiten, Aktivitäten, Geheimnisse und Entdeckungen in Vice City und darüber hinaus.',
      'EXPLORE NOW':'JETZT ENTDECKEN','VIEW LEAKS':'LEAKS ANZEIGEN','OPEN MAP':'KARTE ÖFFNEN','WELCOME TO':'WILLKOMMEN BEI','LATEST LEAKS':'NEUESTE LEAKS','EXPLORE LEONIDA':'LEONIDA ERKUNDEN'
    };
    return known[value]||value||'';
  }
  function applyLanguage(lang,rerender=true){
    app.language=lang==='de'?'de':'en';
    localStorage.setItem('sixworld_language',app.language);
    document.documentElement.lang=app.language;
    $$('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(I18N[app.language]?.[key])el.textContent=t(key);});
    const search=$('#globalSearch'); if(search) search.placeholder=t('search.placeholder');
    const flag=$('#languageFlag'),code=$('#languageCode');
    if(flag)flag.textContent=app.language==='de'?'🇩🇪':'🇬🇧';
    if(code)code.textContent=app.language==='de'?'DE':'EN';
    $('#languageMenu')?.classList.remove('open');
    $('#languageButton')?.setAttribute('aria-expanded','false');
    if(rerender && app.content){
      renderHome();renderMap();setHero(app.heroIndex||0,false,true);setTimeout(()=>hydrateVideoViewCounts(document),20);
      if(app.community.active){const thread=$('#'+app.community.active.threadId);if(thread)paintCommunityThread(thread);}
      const active=app.community.active;
      if(active?.type==='video'&&$('#videoModalViews'))fetchMediaViews('video',active.item).then(v=>$('#videoModalViews').textContent=formatViews(v.views));
      if(active?.type==='screenshot'&&$('#lightboxViews'))fetchMediaViews('screenshot',active.item).then(v=>$('#lightboxViews').textContent=formatViews(v.views));
    }
  }

  const GUEST_NICK_KEY='sixworld_guest_nickname';
  function nickKey(value=''){
    return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t')
      .replace(/[^a-z0-9]/g,'');
  }
  function reservedGuestNick(value=''){
    const n=nickKey(value);
    return !n || n.includes('admin') || n.includes('administrator') || n.startsWith('sixworld') || n.includes('rockstargames') ||
      new Set(['mod','moderator','staff','support','official','owner','root','webmaster','system']).has(n);
  }
  function getGuestNick(){ return (localStorage.getItem(GUEST_NICK_KEY)||'').trim(); }
  function setGuestNick(value){
    const nick=String(value||'').trim().replace(/\s+/g,' ').slice(0,24);
    if(nick.length<2){toast(t('community.nickLength'));return false;}
    if(reservedGuestNick(nick)){toast(t('community.reserved'));return false;}
    localStorage.setItem(GUEST_NICK_KEY,nick);return true;
  }
  function formatCount(value){return Number(value||0).toLocaleString(app.language==='de'?'de-DE':'en-US');}
  function formatViews(value){return `${formatCount(value)} ${t('community.views')}`;}
  function mediaViewKey(type,id){return `${type}:${id}`;}
  async function fetchMediaViews(type,item,{force=false}={}){
    const key=mediaViewKey(type,item?.id||'');
    const cached=app.viewCache.get(key);
    if(!force && cached && Date.now()-cached.time<60000) return cached;
    try{
      const url=new URL('/api/media/views',location.origin);
      url.searchParams.set('type',type);url.searchParams.set('id',item.id);
      if(type==='video'&&item.video)url.searchParams.set('url',item.video);
      const r=await fetch(url,{cache:'no-store'});const d=await r.json();
      const out={views:Number(d.views||0),source:d.source||'sixworld',time:Date.now()};app.viewCache.set(key,out);return out;
    }catch(e){return {views:0,source:'sixworld',time:Date.now()};}
  }
  async function registerMediaView(type,item){
    if(!item?.id)return;
    try{
      await fetch('/api/media/views',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mediaType:type,contentId:item.id})});
      app.viewCache.delete(mediaViewKey(type,item.id));
    }catch(e){}
  }
  async function hydrateVideoViewCounts(scope=document){
    const elements=$$('[data-video-view-id]',scope);
    const unique=new Map();
    elements.forEach(el=>{const id=el.dataset.videoViewId;const item=(app.content.leaks||[]).find(x=>String(x.id)===String(id));if(item)unique.set(String(id),item);});
    await Promise.all([...unique.values()].map(async item=>{
      const data=await fetchMediaViews('video',item);
      $$(`[data-video-view-id="${CSS.escape(String(item.id))}"]`,scope).forEach(el=>el.textContent=formatViews(data.views));
    }));
  }
  function communityDate(value){
    const d=new Date(String(value||'').replace(' ','T')+'Z');
    if(Number.isNaN(d.getTime()))return value||'';
    return new Intl.DateTimeFormat(app.language==='de'?'de-DE':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(d);
  }
  function commentTree(items){
    const map=new Map(items.map(x=>[Number(x.id),{...x,children:[]}])) , roots=[];
    for(const c of map.values()){
      const p=c.parent_id==null?null:map.get(Number(c.parent_id));
      if(p)p.children.push(c);else roots.push(c);
    }
    return roots;
  }
  function commentNodeHtml(c,depth=0){
    const replyOpen=Number(app.community.replyTo)===Number(c.id);
    return `<article class="guest-comment" data-comment-id="${c.id}" style="--comment-depth:${Math.min(depth,4)}">
      <div class="guest-comment-avatar">${escapeHtml((c.nickname||'?').slice(0,1).toUpperCase())}</div>
      <div class="guest-comment-main">
        <div class="guest-comment-head"><b>${escapeHtml(c.nickname)}</b><time>${escapeHtml(communityDate(c.created_at))}</time></div>
        <p>${escapeHtml(c.body).replace(/\n/g,'<br>')}</p>
        <button class="guest-reply-btn" type="button" data-reply-id="${c.id}" data-reply-name="${escapeHtml(c.nickname)}">↳ ${escapeHtml(t('community.reply'))}</button>
        ${replyOpen?commentComposerHtml(c.id,c.nickname,true):''}
        ${c.children?.length?`<div class="comment-children">${c.children.map(x=>commentNodeHtml(x,depth+1)).join('')}</div>`:''}
      </div>
    </article>`;
  }
  function guestIdentityHtml(){
    const nick=getGuestNick();
    if(nick)return `<div class="guest-identity active"><span>${escapeHtml(t('community.commentingAs'))} <b>${escapeHtml(nick)}</b></span><button type="button" data-change-nick>${escapeHtml(t('community.change'))}</button></div>`;
    return `<div class="guest-identity-picker"><div><b>${escapeHtml(t('community.guestTitle'))}</b><small>${escapeHtml(t('community.guestHelp'))}</small></div><div class="guest-nick-row"><input maxlength="24" data-guest-nick placeholder="${escapeHtml(t('community.nickname'))}"><button type="button" data-save-nick>${escapeHtml(t('community.useNickname'))}</button></div></div>`;
  }
  function commentComposerHtml(parentId=null,parentName='',reply=false){
    const nick=getGuestNick();if(!nick)return '';
    return `<form class="guest-comment-form ${reply?'reply-form':''}" data-parent-id="${parentId??''}">
      ${reply?`<div class="replying-to">↳ ${escapeHtml(t('community.reply'))} @${escapeHtml(parentName)} <button type="button" data-cancel-reply>×</button></div>`:''}
      <textarea maxlength="1200" required placeholder="${escapeHtml(reply?t('community.replyPlaceholder'):t('community.placeholder'))}"></textarea>
      <button class="solid-btn compact" type="submit">${escapeHtml(reply?t('community.reply'):t('community.post'))}</button>
    </form>`;
  }
  function paintCommunityThread(thread){
    if(!thread||!app.community.active)return;
    const roots=commentTree(app.community.items||[]);
    thread.innerHTML=`<div class="community-thread-head"><h3>${escapeHtml(t('community.comments'))}</h3><span>${formatCount(app.community.items?.length||0)}</span></div>
      ${guestIdentityHtml()}
      ${commentComposerHtml()}
      <div class="guest-comments-list">${roots.length?roots.map(x=>commentNodeHtml(x)).join(''):`<div class="no-comments">${escapeHtml(t('community.noComments'))}</div>`}</div>`;
    bindCommunityThread(thread);
  }
  async function loadComments(type,item,threadId){
    const thread=$('#'+threadId);if(!thread)return;
    app.community.active={type,item,threadId};app.community.items=[];app.community.replyTo=null;
    thread.innerHTML=`<div class="comments-loading">${escapeHtml(t('community.loading'))}</div>`;
    try{
      const r=await fetch(`/api/community/comments?type=${encodeURIComponent(type)}&id=${encodeURIComponent(item.id)}`,{cache:'no-store'});
      const d=await r.json();app.community.items=Array.isArray(d.items)?d.items:[];
    }catch(e){app.community.items=[];}
    if(app.community.active?.threadId===threadId)paintCommunityThread(thread);
  }
  function bindCommunityThread(thread){
    thread.onclick=async e=>{
      const save=e.target.closest('[data-save-nick]');
      if(save){const input=thread.querySelector('[data-guest-nick]');if(setGuestNick(input?.value||''))paintCommunityThread(thread);return;}
      if(e.target.closest('[data-change-nick]')){localStorage.removeItem(GUEST_NICK_KEY);app.community.replyTo=null;paintCommunityThread(thread);return;}
      const reply=e.target.closest('[data-reply-id]');
      if(reply){if(!getGuestNick()){toast(t('community.guestHelp'));return;}app.community.replyTo=Number(reply.dataset.replyId);paintCommunityThread(thread);setTimeout(()=>thread.querySelector('.reply-form textarea')?.focus(),30);return;}
      if(e.target.closest('[data-cancel-reply]')){app.community.replyTo=null;paintCommunityThread(thread);return;}
    };
    thread.onsubmit=async e=>{
      const form=e.target.closest('.guest-comment-form');if(!form)return;e.preventDefault();
      const active=app.community.active,nick=getGuestNick(),textarea=form.querySelector('textarea');const body=textarea?.value.trim()||'';
      if(!active||!nick||!body)return;
      const button=form.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent='...';}
      try{
        const r=await fetch('/api/community/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mediaType:active.type,contentId:active.item.id,parentId:form.dataset.parentId?Number(form.dataset.parentId):null,nickname:nick,body})});
        const d=await r.json().catch(()=>({}));
        if(!r.ok){toast(d.error||t('community.postFailed'));return;}
        app.community.replyTo=null;await loadComments(active.type,active.item,active.threadId);
      }catch(err){toast(t('community.postFailed'));}
      finally{if(button){button.disabled=false;}}
    };
  }

  const iconSvg = {
    leaks:'<path d="M4 8h16v11H4zM8 8V5h8v3M8 13h.01M12 13h4"/>',
    screens:'<path d="M5 7h3l1-2h6l1 2h3v11H5z"/><circle cx="12" cy="12.5" r="3"/>',
    news:'<path d="M6 3h9l3 3v15H6zM14 3v4h4M9 11h6M9 15h6"/>',
    map:'<path d="M12 22s7-6.4 7-13a7 7 0 1 0-14 0c0 6.6 7 13 7 13Z"/><circle cx="12" cy="9" r="2.4"/>'
  };
  const icon = type => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconSvg[type]||''}</svg>`;
  const mapClass = cat => ['district','landmark','activity','shop','safehouse','secret','transport'].includes(cat) ? cat : 'landmark';

  function parseTime(v){ const t = Date.parse(v||''); return Number.isFinite(t) ? t : 0; }
  function dedupeNews(items){
    const seen = new Set();
    return items.filter(item=>{
      const key = item.url || item.id || item.title;
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function mergedNewsList(){
    const manual = app.content.news || [];
    const live = app.content.feeds?.enabled ? (app.liveFeedItems || []) : [];
    return dedupeNews([...live, ...manual]).sort((a,b)=>parseTime(b.date)-parseTime(a.date));
  }

  async function fetchFeed(url){
    try{
      const r = await fetch(url,{cache:'no-store'});
      if(!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data.items) ? data.items : [];
    }catch(e){ return []; }
  }

  async function refreshFeeds({silent=false}={}){
    const cfg = app.content.feeds || {};
    if(cfg.enabled===false){ app.liveFeedItems=[]; if(!silent) toast('Live feeds disabled in settings.'); return []; }
    const subreddits = Array.isArray(cfg.subreddits) && cfg.subreddits.length
      ? cfg.subreddits.map(x=>String(x).replace(/^r\//i,'').trim()).filter(Boolean)
      : ['GTA6unmoderated','GTA6_NEW'];
    const xUser = cfg.xUser || 'RockstarGames';
    const maxItems = Math.max(1, Number(cfg.maxItems)||10);
    const [reddit, xFeed] = await Promise.all([
      fetchFeed(`/api/feed/reddit?subreddits=${encodeURIComponent(subreddits.join(','))}`),
      fetchFeed(`/api/feed/x?user=${encodeURIComponent(xUser)}`)
    ]);
    app.liveFeedItems = dedupeNews([...xFeed, ...reddit]).sort((a,b)=>parseTime(b.date)-parseTime(a.date)).slice(0,maxItems);
    if(!silent){
      renderHome();
      renderNews();
      toast(`Feeds refreshed · ${app.liveFeedItems.length} live items`);
    }
    return app.liveFeedItems;
  }

  function heroDuration(slide){return Math.max(2,Math.min(60,Number(slide?.duration)||7));}
  function normalizeHeroVideo(url=''){
    const raw=String(url||'').trim();
    if(!raw) return {type:'none',url:''};
    if(/\.(mp4|webm|ogg)(\?|#|$)/i.test(raw)) return {type:'video',url:raw};
    if(/youtube\.com\/watch\?v=/i.test(raw)){try{const id=new URL(raw).searchParams.get('v');return {type:'iframe',url:`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0`}}catch(e){}}
    if(/youtu\.be\//i.test(raw)){const id=raw.split('/').pop().split(/[?#]/)[0];return {type:'iframe',url:`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0`};}
    if(/streamable\.com\//i.test(raw)){const id=raw.split('/').filter(Boolean).pop().split(/[?#]/)[0];return {type:'iframe',url:`https://streamable.com/e/${id}?autoplay=1&muted=1`};}
    if(/vimeo\.com\//i.test(raw)){const id=raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];if(id)return {type:'iframe',url:`https://player.vimeo.com/video/${id}?autoplay=1&muted=1&background=1&loop=1`};}
    if(/drive\.google\.com\/file\/d\//i.test(raw)){const id=raw.split('/file/d/')[1]?.split('/')[0];if(id)return {type:'iframe',url:`https://drive.google.com/file/d/${id}/preview`};}
    return {type:'iframe',url:raw};
  }
  function renderHeroMedia(slide){
    const layer=$('#heroVideoLayer'); if(!layer)return;
    layer.innerHTML='';layer.classList.remove('active');
    if((slide?.mediaType||'image')!=='video' || !slide.video)return;
    const media=normalizeHeroVideo(slide.video);
    if(media.type==='video'){
      const video=document.createElement('video');
      video.src=media.url;video.autoplay=true;video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.setAttribute('muted','');video.setAttribute('playsinline','');
      layer.appendChild(video);video.play().catch(()=>{});
    }else if(media.type==='iframe'){
      const frame=document.createElement('iframe');frame.src=media.url;frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.setAttribute('frameborder','0');frame.setAttribute('tabindex','-1');
      layer.appendChild(frame);
    }
    requestAnimationFrame(()=>layer.classList.add('active'));
  }
  function scheduleHero(){
    clearTimeout(app.heroTimer);
    const slides=app.content.hero||[];if(!slides.length)return;
    const duration=heroDuration(slides[app.heroIndex]);
    app.heroTimer=setTimeout(()=>setHero((app.heroIndex+1)%slides.length,false),duration*1000);
  }
  function renderHero(){
    const slides = app.content.hero || [];
    if(!slides.length) return;
    app.heroIndex = Math.min(app.heroIndex||0,slides.length-1);
    const dots = $('#heroDots');
    dots.innerHTML = slides.map((_,i)=>`<button aria-label="Slide ${i+1}" data-slide="${i}" class="${i===app.heroIndex?'active':''}"></button>`).join('');
    dots.onclick = e => { const b = e.target.closest('button'); if(b) setHero(+b.dataset.slide, true); };
    setHero(app.heroIndex,false);
  }
  function setHero(i,manual=false,skipSchedule=false){
    const slides = app.content.hero || [];
    const s = slides[i]; if(!s) return;
    app.heroIndex = i;
    const bg = $('#heroBg');
    bg.classList.add('switching');
    setTimeout(()=>{ bg.style.backgroundImage = `url("${s.image||'assets/gta-6-trailer-2.jpg'}")`; bg.classList.remove('switching'); }, 120);
    renderHeroMedia(s);
    $('#heroEyebrow').textContent = translateContentText(s.eyebrow || 'WELCOME TO');
    $('#heroDescription').textContent = translateContentText(s.description || '');
    const cta = $('#heroCta');
    cta.innerHTML = `${escapeHtml(translateContentText(s.cta||'EXPLORE NOW'))} <span>›</span>`;
    cta.href = s.href || '#news';
    $$('#heroDots button').forEach((b,n)=>b.classList.toggle('active', n===i));
    const duration=heroDuration(s);
    const p = $('#heroProgress');
    p.style.transition = 'none'; p.style.width = '0';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ p.style.transition=`width ${Math.max(.2,duration-.15)}s linear`; p.style.width='100%'; }));
    if(!skipSchedule)scheduleHero();
  }

  function homePanelHeader(type,titleKey,href,cyan=false){
    return `<div class="panel-head"><div class="panel-title ${cyan?'cyan':''}">${icon(type)}<span>${escapeHtml(t(titleKey))}</span></div><a class="panel-link ${cyan?'cyan':''}" href="${href}">${escapeHtml(type==='map'?t('home.explore'):t('home.viewAll'))}${type==='map'?' ↗':''}</a></div>`;
  }

  function renderHome(){
    const leaks=(app.content.leaks||[]).slice(0,5);
    $('#homeLeaks').innerHTML = homePanelHeader('leaks','home.leaks','#leaks') + leaks.map(l=>`
      <div class="leak-mini" data-video-id="${escapeHtml(l.id)}">
        <div class="thumb"><img src="${escapeHtml(l.thumb)}" alt=""><i class="play"></i><span class="duration">${escapeHtml(l.duration||'')}</span></div>
        <div class="mini-copy"><b>${escapeHtml(l.title)}</b><div class="mini-meta"><small>${escapeHtml(l.date)}</small><small class="video-view-count" data-video-view-id="${escapeHtml(l.id)}">— ${escapeHtml(t('community.views'))}</small></div></div>
      </div>`).join('');

    const shots=(app.content.screenshots||[]).slice(0,6);
    $('#homeScreens').innerHTML = homePanelHeader('screens','home.screenshots','#screenshots',true) +
      `<div class="screens-mini">${shots.map(s=>`<button data-shot-id="${escapeHtml(s.id)}"><img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.title)}"></button>`).join('')}</div>
       <div class="carousel-pips"><i></i><i></i><i></i><i></i><i></i></div>`;

    const news=mergedNewsList().slice(0,5);
    $('#homeNews').innerHTML = homePanelHeader('news','home.news','#news') + news.map(n=>`
      <a class="news-mini" href="${escapeHtml(n.url||'#news')}" target="${String(n.url||'').startsWith('http')?'_blank':'_self'}">
        <div class="thumb"><img src="${escapeHtml(n.image)}" alt=""></div>
        <div class="mini-copy"><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.date)}</small></div>
      </a>`).join('');

    $('#homeMap').innerHTML = homePanelHeader('map','home.map','#map',true) +
      `<a href="#map" class="map-preview" aria-label="Interactive Map">
        <img src="${escapeHtml(app.content.map?.image||'assets/InteractiveMap/GTA6MAP.png')}" alt="Map">
        <div class="map-preview-overlay"></div>
        <i class="preview-marker one">🌴</i>
        <i class="preview-marker two">▦</i>
        <i class="preview-marker cyan three">⌂</i>
        <i class="preview-marker four">💎</i>
        <div class="map-preview-ui"><button>+</button><button>−</button><button>⌖</button></div>
        <span class="map-preview-label">VICE CITY & BEYOND</span>
      </a>`;
  }

  function renderLeaks(){
    const arr=app.content.leaks||[];
    $('#leakCount').textContent=arr.length;
    $('#leaksGrid').innerHTML = arr.map(l=>`
      <article class="media-card" data-video-id="${escapeHtml(l.id)}">
        <div class="cover"><img src="${escapeHtml(l.thumb)}" alt="${escapeHtml(l.title)}"><i class="play"></i><span class="duration">${escapeHtml(l.duration||'')}</span></div>
        <div class="body"><h3>${escapeHtml(l.title)}</h3><div class="meta"><span>${escapeHtml(l.date)}</span><span>${escapeHtml(l.source||'')}</span><span class="video-view-count" data-video-view-id="${escapeHtml(l.id)}">— ${escapeHtml(t('community.views'))}</span></div></div>
      </article>`).join('');
  }

  function renderScreens(){
    const arr=app.content.screenshots||[];
    $('#screenCount').textContent=arr.length;
    $('#screensGrid').innerHTML = arr.map(s=>`
      <button class="shot-card" data-shot-id="${escapeHtml(s.id)}">
        <img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.title)}">
        <span class="shot-info"><b>${escapeHtml(s.title)}</b><small>${escapeHtml(s.source||'')}</small></span>
      </button>`).join('');
  }

  function renderNews(){
    const arr=mergedNewsList();
    $('#newsList').innerHTML = arr.map(n=>`
      <a class="news-item" href="${escapeHtml(n.url||'#')}" target="${String(n.url||'').startsWith('http')?'_blank':'_self'}">
        <img src="${escapeHtml(n.image)}" alt="">
        <div><span class="source-badge">${escapeHtml(n.source||'NEWS')}</span><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary||'')}</p><small>${escapeHtml(n.date||'')}</small></div>
        <div class="arrow">→</div>
      </a>`).join('');
  }

  function getMapCategories(){ return app.content.map?.categories || []; }

  const mapCategoryStyle={
    district:{label:'Districts'}, landmark:{label:'Landmarks'}, activity:{label:'Activities'},
    shop:{label:'Shops'}, safehouse:{label:'Safehouses'}, secret:{label:'Secrets'}, transport:{label:'Transport'}
  };

  const mapIconPaths={
    district:'<path d="M4 20V8l4-2v14M10 20V4h6v16M18 20v-9l3 2v7M3 20h19"/><path d="M12 7h2M12 10h2M12 13h2M6 11h1M6 14h1M19 15h1"/>',
    landmark:'<path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.02l-5.5 2.9 1.05-6.12L3.1 9.47l6.15-.9L12 3Z"/>',
    activity:'<circle cx="13" cy="5" r="2"/><path d="m9 21 2.5-6-3-2 2.2-4 3.3 2 3.5-1.5M13 12l3 3 4 1M8.5 13 5 17"/>',
    shop:'<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    safehouse:'<path d="m3 11 9-7 9 7v9H3v-9Z"/><path d="M9 20v-6h6v6"/>',
    secret:'<path d="m12 3 8 9-8 9-8-9 8-9Z"/><path d="m8 12 3 3 5-6"/>',
    transport:'<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M7 8h10M8 18v3M16 18v3M8 13h.01M16 13h.01"/>'
  };
  function mapIconSvg(category, extraClass=''){
    const key=mapClass(category);
    return `<svg class="map-custom-icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true">${mapIconPaths[key]||mapIconPaths.landmark}</svg>`;
  }
  function factIconSvg(type){
    const paths={
      region:'<path d="M12 22s7-6.4 7-13a7 7 0 1 0-14 0c0 6.6 7 13 7 13Z"/><circle cx="12" cy="9" r="2.3"/>',
      district:mapIconPaths.district,
      poi:'<path d="m12 3 7 4v7c0 4-3 6-7 7-4-1-7-3-7-7V7l7-4Z"/><path d="m9 12 2 2 4-5"/>',
      date:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>'
    };
    return `<svg class="map-fact-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[type]||paths.poi}</svg>`;
  }

  function renderMapFilters(){
    const filters=getMapCategories();
    $('#mapFilters').innerHTML=filters.map((f,i)=>`<button class="map-filter-btn ${i===0?'active':''}" data-map-filter="${escapeHtml(f.key)}"><span class="map-filter-icon ${mapClass(f.key)}">${mapIconSvg(f.key)}</span><span>${escapeHtml(t('map.'+f.key)||f.label||f.key)}</span></button>`).join('');
    $$('.map-filter-btn[data-map-filter]').forEach(b=>b.onclick=()=>{
      const already=b.classList.contains('active');
      $$('.map-filter-btn').forEach(x=>x.classList.remove('active'));
      if(!already) b.classList.add('active');
      const f=already?'all':b.dataset.mapFilter;
      $$('.map-blip').forEach(x=>x.classList.toggle('hidden',f!=='all'&&x.dataset.category!==f));
    });
  }

  function renderMapLegend(){
    $('#mapLegend').innerHTML=getMapCategories().filter(x=>x.key!=='district').map(cat=>`<div class="legend-ref-item"><i class="legend-pin ${mapClass(cat.key)}">${mapIconSvg(cat.key,'legend-icon')}</i><span>${escapeHtml(t('map.'+cat.key)||cat.legend||cat.label||cat.key)}</span></div>`).join('');
  }

  function mapTagsHtml(tags=[]){ return tags.slice(0,4).map(t=>`<span>${escapeHtml(t)}</span>`).join(''); }

  function updateMapDetail(blip){
    if(!blip){
      app.selectedMapBlipId=null;
      const title=$('#mapDetailTitle'), region=$('#mapDetailRegion'), desc=$('#mapDetailDescription');
      if(title) title.textContent='NO LOCATION SELECTED';
      if(region) region.textContent='LEONIDA';
      if(desc) desc.textContent='Add locations in the Admin Panel to show them on the interactive map.';
      const tags=$('#mapDetailTags'), facts=$('#mapDetailFacts'), badge=$('#mapFeaturedBadge');
      if(tags) tags.innerHTML='';
      if(facts) facts.innerHTML='';
      if(badge) badge.style.display='none';
      $$('.map-blip,.recent-card').forEach(x=>x.classList.remove('selected'));
      return;
    }
    app.selectedMapBlipId=blip.id;
    $('#mapInfoPanel')?.classList.remove('collapsed');
    $('#mapDetailImage').src=blip.image||'assets/nighttimepink.webp';
    $('#mapDetailTitle').textContent=(blip.label||'LOCATION').toUpperCase();
    $('#mapDetailRegion').textContent=(blip.region||'LEONIDA').toUpperCase();
    $('#mapDetailDescription').textContent=blip.description||'No description yet.';
    const detailTags=[...(Array.isArray(blip.tags)?blip.tags:[mapCategoryStyle[blip.category]?.label||blip.category])];
    if(blip.status && !detailTags.some(x=>String(x).toLowerCase()===String(blip.status).toLowerCase())) detailTags.push(String(blip.status).toUpperCase());
    $('#mapDetailTags').innerHTML=mapTagsHtml(detailTags);
    $('#mapDetailFacts').innerHTML=`
      <div><span>${factIconSvg('region')} ${escapeHtml(t('map.region'))}</span><b>${escapeHtml(blip.region||'Leonida')}</b></div>
      <div><span>${factIconSvg('district')} ${escapeHtml(t('map.districtFact'))}</span><b>${escapeHtml(blip.district||'—')}</b></div>
      <div><span>${factIconSvg('poi')} ${escapeHtml(t('map.poi'))}</span><b>${escapeHtml(blip.poiCount??'—')}</b></div>
      <div><span>${factIconSvg('date')} ${escapeHtml(t('map.discovered'))}</span><b>${escapeHtml(blip.discovered||'—')}</b></div>`;
    $('#mapFeaturedBadge').style.display=blip.featured?'inline-flex':'none';
    $$('.map-blip').forEach(x=>x.classList.toggle('selected',String(x.dataset.id)===String(blip.id)));
    $$('.recent-card').forEach(x=>x.classList.toggle('selected',String(x.dataset.blipId)===String(blip.id)));
  }

  function renderRecentDiscovered(){
    const all=(app.content.map?.blips||[]).filter(x=>x.image);
    const curated=all.filter(x=>x.recent===true);
    const items=(curated.length?curated:all.slice(-6).reverse()).slice(0,6);
    $('#recentDiscovered').innerHTML=items.length
      ? items.map(b=>`<button class="recent-card" data-blip-id="${escapeHtml(b.id)}"><img src="${escapeHtml(b.image)}" alt=""><span class="recent-card-copy"><b>${escapeHtml(b.label)}</b><small><i class="recent-cat ${mapClass(b.category)}">${mapIconSvg(b.category,'recent-icon')}</i>${escapeHtml(mapCategoryStyle[b.category]?.label||b.category)}</small></span></button>`).join('')
      : '<div class="recent-empty">NO LOCATIONS DISCOVERED YET</div>';
    $$('.recent-card').forEach(card=>card.onclick=()=>{ const b=(app.content.map.blips||[]).find(x=>String(x.id)===card.dataset.blipId); if(b) updateMapDetail(b); });
  }

  function renderMap(){
    const m=app.content.map||{};
    $('#mapImage').src=m.image||'assets/InteractiveMap/GTA6MAP.png';
    requestAnimationFrame(()=>setTimeout(updateMapStageMetrics,30));
    const logo=$('.leonida-map-logo'); if(logo) logo.src=m.logo||'assets/logo/Leonidaloga.png';
    $('#mapUpdatedDate').textContent=(m.updatedDate||'May 12, 2025').toUpperCase();
    $('#mapBlips').innerHTML=(m.blips||[]).map(b=>`<button class="map-blip ${mapClass(b.category)}" data-id="${escapeHtml(b.id)}" data-category="${escapeHtml(b.category||'landmark')}" style="left:${Number(b.x)||50}%;top:${Number(b.y)||50}%"><span>${mapIconSvg(b.category,'blip-icon')}</span></button>`).join('');
    renderMapFilters();
    renderMapLegend();
    renderRecentDiscovered();
    const selected=(m.blips||[]).find(x=>String(x.id)===String(app.selectedMapBlipId)) || (m.blips||[]).find(x=>x.featured) || m.blips?.[0];
    updateMapStageMetrics();
    resetMap();
    updateMapDetail(selected||null);
    $$('.map-blip').forEach(el=>el.onclick=e=>{ e.stopPropagation(); const b=(m.blips||[]).find(x=>String(x.id)===String(el.dataset.id)); if(b) updateMapDetail(b); });
  }

  function applySettings(){
    const s=app.content.settings||{};
    document.documentElement.style.setProperty('--pink', s.accent || '#ff4fa3');
    document.documentElement.style.setProperty('--cyan', s.accent2 || '#42e6ee');
    const bg=String(s.backgroundImage||'assets/site-background.png').replace(/["\\]/g,'');
    document.documentElement.style.setProperty('--site-background-image', `url("${bg}")`);
    $('#globalSearch').placeholder = app.language==='de'?'Suchen...':(s.searchPlaceholder || 'Search...');
    $('#adminTrigger').textContent = app.content.access?.secretText || 'sw_6.0.22';
    document.title = `${s.siteName || 'SIXWORLD'} — GTA VI News, Leaks & Map`;
  }

  function renderAll(){
    applySettings();
    renderHero();
    renderHome();
    renderLeaks();
    renderScreens();
    renderNews();
    renderMap();
    applyLanguage(app.language,false);
    setTimeout(()=>hydrateVideoViewCounts(document),25);
  }

  function openModal(id){ const m=$('#'+id); m.classList.add('open'); m.setAttribute('aria-hidden','false'); }
  function closeModal(id){ const m=$('#'+id); m.classList.remove('open'); m.setAttribute('aria-hidden','true'); if(id==='videoModal') $('#videoFrameWrap').innerHTML=''; }
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
  $$('.modal').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) closeModal(m.id); }));

  document.addEventListener('click',e=>{
    const v=e.target.closest('[data-video-id]');
    if(v){ const item=(app.content.leaks||[]).find(x=>x.id===v.dataset.videoId); if(item) showVideo(item); }
    const s=e.target.closest('[data-shot-id]');
    if(s){ const item=(app.content.screenshots||[]).find(x=>x.id===s.dataset.shotId); if(item) showShot(item); }
  });

  function normalizeVideo(url=''){
    if(/streamable\.com\//i.test(url) && !/\/e\//.test(url)){ const id=url.split('/').filter(Boolean).pop(); return `https://streamable.com/e/${id}`; }
    if(/drive\.google\.com\/file\/d\//i.test(url)){ const id=url.split('/file/d/')[1]?.split('/')[0]; if(id) return `https://drive.google.com/file/d/${id}/preview`; }
    if(/youtube\.com\/watch\?v=/.test(url)){ const id=new URL(url).searchParams.get('v'); return `https://www.youtube.com/embed/${id}`; }
    if(/youtu\.be\//.test(url)){ return `https://www.youtube.com/embed/${url.split('/').pop().split('?')[0]}`; }
    return url;
  }
  async function showVideo(item){
    const u=normalizeVideo(item.video||'');
    $('#videoFrameWrap').innerHTML = /\.(mp4|webm)(\?|$)/i.test(u)
      ? `<video controls autoplay src="${escapeHtml(u)}"></video>`
      : `<iframe src="${escapeHtml(u)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
    $('#videoModalTitle').textContent=item.title||'';
    $('#videoModalDate').textContent=item.date||'';
    $('#videoModalViews').textContent=`— ${t('community.views')}`;
    openModal('videoModal');
    await registerMediaView('video',item);
    loadComments('video',item,'videoComments');
    const view=await fetchMediaViews('video',item,{force:true});
    if($('#videoModalViews'))$('#videoModalViews').textContent=formatViews(view.views);
    hydrateVideoViewCounts();
  }
  async function showShot(item){
    $('#lightboxImage').src=item.image;
    $('#lightboxTitle').textContent=item.title||'';
    $('#lightboxSource').textContent=item.source||'';
    $('#lightboxViews').textContent=`— ${t('community.views')}`;
    openModal('lightbox');
    await registerMediaView('screenshot',item);
    loadComments('screenshot',item,'screenshotComments');
    const view=await fetchMediaViews('screenshot',item,{force:true});
    if($('#lightboxViews'))$('#lightboxViews').textContent=formatViews(view.views);
  }

  function setMobileMenu(open){
    const menu=$('#headerMenu'), btn=$('#mobileMenuBtn');
    if(!menu||!btn) return;
    menu.classList.toggle('open',!!open);
    btn.classList.toggle('open',!!open);
    btn.setAttribute('aria-expanded',open?'true':'false');
    btn.setAttribute('aria-label',open?t('menu.close'):t('menu.open'));
  }
  $('#mobileMenuBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    setMobileMenu(!$('#headerMenu').classList.contains('open'));
  });
  $('#mobileSearchBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    setMobileMenu(true);
    setTimeout(()=>$('#globalSearch')?.focus(),80);
  });
  $('#mobileProfileBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    toast(t('profile.notice'));
  });
  $('#mobileFilterToggle')?.addEventListener('click',()=>{
    $('.map-filter-panel')?.classList.toggle('expanded');
  });
  $('#headerMenu')?.addEventListener('click',e=>e.stopPropagation());
  document.addEventListener('click',()=>{ if(matchMedia('(max-width:920px)').matches) setMobileMenu(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') setMobileMenu(false); });
  addEventListener('resize',()=>{ if(!matchMedia('(max-width:920px)').matches) setMobileMenu(false); });

  function setLanguageMenu(open){
    $('#languageMenu')?.classList.toggle('open',!!open);
    $('#languageButton')?.setAttribute('aria-expanded',open?'true':'false');
  }
  $('#languageButton')?.addEventListener('click',e=>{e.stopPropagation();setLanguageMenu(!$('#languageMenu')?.classList.contains('open'));});
  $('#languageMenu')?.addEventListener('click',e=>{e.stopPropagation();const btn=e.target.closest('[data-language]');if(btn)applyLanguage(btn.dataset.language,true);});
  document.addEventListener('click',()=>setLanguageMenu(false));

  function route(){
    const r=(location.hash||'#home').slice(1).split('?')[0];
    const valid=['home','leaks','screenshots','news','map'];
    const page=valid.includes(r)?r:'home';
    $$('.page').forEach(p=>p.classList.toggle('active', p.dataset.page===page));
    $$('.nav a').forEach(a=>a.classList.toggle('active', a.dataset.route===page));
    setMobileMenu(false);
    window.scrollTo({top:0,behavior:'instant'});
    if(page==='home'||page==='leaks') setTimeout(()=>hydrateVideoViewCounts(document),20);
  }
  addEventListener('hashchange', route);

  let mapScale=1, mapX=0, mapY=0, drag=false, sx=0, sy=0, mapMarkersVisible=true;
  let mapBaseScale=1, mapNaturalW=0, mapNaturalH=0;
  function updateMapStageMetrics(){
    const stage=$('#mapStage'), viewport=$('#mapViewport'), img=$('#mapImage');
    if(!stage || !viewport || !img || !img.naturalWidth || !img.naturalHeight) return;
    mapNaturalW=img.naturalWidth;
    mapNaturalH=img.naturalHeight;
    mapBaseScale=Math.min(viewport.clientWidth / mapNaturalW, viewport.clientHeight / mapNaturalH) || 1;
    stage.style.width=mapNaturalW + 'px';
    stage.style.height=mapNaturalH + 'px';
    applyMap();
  }
  function applyMap(){
    const stage=$('#mapStage');
    if(stage) stage.style.transform=`translate(calc(-50% + ${mapX}px), calc(-50% + ${mapY}px)) scale(${(mapBaseScale * mapScale).toFixed(4)})`;
  }
  function resetMap(){ mapScale=1; mapX=0; mapY=0; applyMap(); }
  function bindMapTool(selector,handler){
    const el=$(selector); if(!el) return;
    el.addEventListener('pointerdown',e=>{e.stopPropagation();});
    el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handler(el);});
  }
  bindMapTool('#zoomIn',()=>{mapScale=Math.min(2.4,mapScale+.15);applyMap();});
  bindMapTool('#zoomOut',()=>{mapScale=Math.max(.85,mapScale-.15);applyMap();});
  bindMapTool('#mapLayers',el=>{
    mapMarkersVisible=!mapMarkersVisible;
    const layer=$('#mapBlips');
    if(layer){layer.classList.toggle('markers-hidden',!mapMarkersVisible);layer.setAttribute('aria-hidden',mapMarkersVisible?'false':'true');}
    el.classList.toggle('active',!mapMarkersVisible);
    el.title=mapMarkersVisible?'Hide map markers':'Show map markers';
  });
  bindMapTool('#zoomFullscreen',async el=>{
    const viewport=$('#mapViewport'); if(!viewport) return;
    try{
      if(!document.fullscreenElement) await viewport.requestFullscreen?.();
      else await document.exitFullscreen?.();
    }catch(err){ toast('Fullscreen is not available in this browser.'); }
  });
  document.addEventListener('fullscreenchange',()=>$('#zoomFullscreen')?.classList.toggle('active',!!document.fullscreenElement));
  $('#mapResetFilters')?.addEventListener('click',()=>{
    $$('.map-filter-btn').forEach(x=>x.classList.remove('active'));
    $$('.map-blip').forEach(x=>x.classList.remove('hidden'));
    mapMarkersVisible=true;
    $('#mapBlips')?.classList.remove('markers-hidden');
    $('#mapLayers')?.classList.remove('active');
    resetMap();
  });
  $('#mapInfoClose')?.addEventListener('click',()=>$('#mapInfoPanel')?.classList.toggle('collapsed'));
  $('#mapViewport').addEventListener('wheel',e=>{ e.preventDefault(); mapScale=Math.min(2.4,Math.max(.85,mapScale+(e.deltaY<0?.1:-.1))); applyMap(); }, {passive:false});
  $('#mapViewport').addEventListener('pointerdown',e=>{ if(e.target.closest('.map-blip,.map-zoom')) return; drag=true; sx=e.clientX-mapX; sy=e.clientY-mapY; $('#mapViewport').classList.add('dragging'); e.currentTarget.setPointerCapture(e.pointerId); });
  $('#mapViewport').addEventListener('pointermove',e=>{ if(!drag) return; mapX=e.clientX-sx; mapY=e.clientY-sy; applyMap(); });
  $('#mapViewport').addEventListener('pointerup',()=>{ drag=false; $('#mapViewport').classList.remove('dragging'); });
  $('#mapViewport').addEventListener('pointercancel',()=>{ drag=false; $('#mapViewport').classList.remove('dragging'); });
  $('#mapImage')?.addEventListener('dragstart',e=>e.preventDefault());
  $('#mapImage')?.addEventListener('load',()=>{ updateMapStageMetrics(); resetMap(); });
  addEventListener('resize',()=>{ updateMapStageMetrics(); });

  // Public content protection: suppress the browser context menu and native media dragging.
  // This only discourages casual downloads; browser-delivered assets can never be made impossible to save.
  document.addEventListener('contextmenu',e=>{
    if(e.target.closest('#adminOverlay')) return;
    e.preventDefault();
  });
  document.addEventListener('dragstart',e=>{
    if(e.target.closest('#adminOverlay')) return;
    if(e.target.closest('img,video,a')) e.preventDefault();
  });

  $('#globalSearch').addEventListener('input',e=>{
    const q=e.target.value.trim().toLowerCase();
    $$('.media-card,.shot-card,.news-item,.leak-mini,.news-mini').forEach(el=>{
      el.style.display = !q || el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  $('#profileBtn').addEventListener('click',()=>toast(t('profile.notice')));
  $('#syncNewsBtn').addEventListener('click',()=>refreshFeeds({silent:false}));

  async function loadSiteStats(){
    try{
      const r=await fetch('/api/stats',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok) throw new Error('stats unavailable');
      const d=await r.json();
      $('#visitorCount').textContent=Number(d.visitors||0).toLocaleString('de-DE');
      $('#hitCount').textContent=Number(d.hits||0).toLocaleString('de-DE');
      app.stats=d;
    }catch(e){
      const local=JSON.parse(localStorage.getItem('sixworld_local_stats')||'{"visitors":1,"hits":0}');
      if(!localStorage.getItem('sixworld_local_stats')) localStorage.setItem('sixworld_local_stats',JSON.stringify(local));
      $('#visitorCount').textContent=Number(local.visitors||1).toLocaleString('de-DE');
      $('#hitCount').textContent=Number(local.hits||0).toLocaleString('de-DE');
    }
  }

  function registerHit(){
    if($('#adminOverlay')?.classList.contains('open')) return;
    try{
      fetch('/api/stats',{method:'POST',credentials:'same-origin',keepalive:true}).then(r=>r.ok?r.json():null).then(d=>{
        if(d){ $('#visitorCount').textContent=Number(d.visitors||0).toLocaleString('de-DE'); $('#hitCount').textContent=Number(d.hits||0).toLocaleString('de-DE'); }
      }).catch(()=>{});
    }catch(e){}
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#adminOverlay,#loginModal,#adminTrigger,#siteCounter')) return;
    const clickable=e.target.closest('a,button,[data-video-id],[data-shot-id],.map-blip,.recent-card');
    if(clickable) registerHit();
  },true);

  function toast(msg){
    const t=$('#toast');
    t.textContent=msg;
    t.classList.add('show');
    clearTimeout(app.toastTimer);
    app.toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  app.openModal=openModal;
  app.closeModal=closeModal;
  app.renderAll=renderAll;
  app.toast=toast;
  app.refreshFeeds=refreshFeeds;
  app.applyLanguage=applyLanguage;

  (async()=>{
    app.content = await loadContent();
    normalizeContent();
    if(!localStorage.getItem('sixworld_language')) app.language=app.content.settings?.defaultLanguage==='de'?'de':'en';
    await mergeCommunityMapLocations();
    renderAll();
    route();
    loadSiteStats();
    refreshFeeds({silent:true}).then(()=>{ renderHome(); renderNews(); }).catch(()=>{});
  })();
})();
