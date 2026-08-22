(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const escapeHtml = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const FALLBACK_KEY = 'sixworld_content_v3';
  const app = window.SIXWORLD = { content:null, backend:false, escapeHtml, FALLBACK_KEY, toast:null, liveFeedItems:[] };

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
    app.content.settings ||= {siteName:'SIXWORLD',searchPlaceholder:'Search...',accent:'#ff4fa3',accent2:'#42e6ee'};
    app.content.access ||= {secretText:'sw_6.0.22',secretPage:'map',demoUser:'admin',demoPass:'sixworld'};
    app.content.hero ||= [];
    app.content.leaks ||= [];
    app.content.screenshots ||= [];
    app.content.news ||= [];
    app.content.map ||= {image:'assets/InteractiveMap/GTA6MAP.png',introLabel:'VICE CITY & BEYOND',categories:[],blips:[]};
    app.content.map.categories ||= [
      {key:'all',label:'ALL',legend:'ALL LOCATIONS',short:'ALL'},
      {key:'city',label:'CITY',legend:'CITY / AREA',short:'VC'},
      {key:'poi',label:'POI',legend:'POINT OF INTEREST',short:'POI'},
      {key:'leak',label:'LEAK',legend:'LEAK / RUMOR',short:'?'}
    ];
    app.content.map.blips ||= [];
    app.content.feeds ||= {enabled:true, subreddit:'GTA6', xUser:'RockstarGames', maxItems:6};
  }

  const iconSvg = {
    leaks:'<path d="M4 8h16v11H4zM8 8V5h8v3M8 13h.01M12 13h4"/>',
    screens:'<path d="M5 7h3l1-2h6l1 2h3v11H5z"/><circle cx="12" cy="12.5" r="3"/>',
    news:'<path d="M6 3h9l3 3v15H6zM14 3v4h4M9 11h6M9 15h6"/>',
    map:'<path d="M12 22s7-6.4 7-13a7 7 0 1 0-14 0c0 6.6 7 13 7 13Z"/><circle cx="12" cy="9" r="2.4"/>'
  };
  const icon = type => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconSvg[type]||''}</svg>`;
  const mapClass = cat => ['city','poi','leak'].includes(cat) ? cat : 'poi';

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
    const subreddit = cfg.subreddit || 'GTA6';
    const xUser = cfg.xUser || 'RockstarGames';
    const maxItems = Math.max(1, Number(cfg.maxItems)||6);
    const [reddit, xFeed] = await Promise.all([
      fetchFeed(`/api/feed/reddit?subreddit=${encodeURIComponent(subreddit)}`),
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

  function renderHero(){
    const slides = app.content.hero || [];
    if(!slides.length) return;
    app.heroIndex = 0;
    const dots = $('#heroDots');
    dots.innerHTML = slides.map((_,i)=>`<button aria-label="Slide ${i+1}" data-slide="${i}" class="${i===0?'active':''}"></button>`).join('');
    dots.onclick = e => { const b = e.target.closest('button'); if(b) setHero(+b.dataset.slide, true); };
    setHero(0,false);
    clearInterval(app.heroTimer);
    app.heroTimer = setInterval(()=>setHero((app.heroIndex+1)%slides.length,false), 7000);
  }
  function setHero(i,manual){
    const slides = app.content.hero || [];
    const s = slides[i]; if(!s) return;
    app.heroIndex = i;
    const bg = $('#heroBg');
    bg.classList.add('switching');
    setTimeout(()=>{ bg.style.backgroundImage = `url("${s.image}")`; bg.classList.remove('switching'); }, 150);
    $('#heroEyebrow').textContent = s.eyebrow || 'WELCOME TO';
    $('#heroDescription').textContent = s.description || '';
    const cta = $('#heroCta');
    cta.innerHTML = `${escapeHtml(s.cta||'EXPLORE NOW')} <span>›</span>`;
    cta.href = s.href || '#news';
    $$('#heroDots button').forEach((b,n)=>b.classList.toggle('active', n===i));
    const p = $('#heroProgress');
    p.style.transition = 'none'; p.style.width = '0';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ p.style.transition='width 6.75s linear'; p.style.width='100%'; }));
    if(manual){ clearInterval(app.heroTimer); app.heroTimer=setInterval(()=>setHero((app.heroIndex+1)%slides.length,false),7000); }
  }

  function homePanelHeader(type,title,href,cyan=false){
    return `<div class="panel-head"><div class="panel-title ${cyan?'cyan':''}">${icon(type)}<span>${title}</span></div><a class="panel-link ${cyan?'cyan':''}" href="${href}">${type==='map'?'EXPLORE ↗':'VIEW ALL'}</a></div>`;
  }

  function renderHome(){
    const leaks=(app.content.leaks||[]).slice(0,3);
    $('#homeLeaks').innerHTML = homePanelHeader('leaks','LEAKS','#leaks') + leaks.map(l=>`
      <div class="leak-mini" data-video-id="${escapeHtml(l.id)}">
        <div class="thumb"><img src="${escapeHtml(l.thumb)}" alt=""><i class="play"></i><span class="duration">${escapeHtml(l.duration||'')}</span></div>
        <div class="mini-copy"><b>${escapeHtml(l.title)}</b><small>${escapeHtml(l.date)}</small></div>
      </div>`).join('');

    const shots=(app.content.screenshots||[]).slice(0,6);
    $('#homeScreens').innerHTML = homePanelHeader('screens','SCREENSHOTS','#screenshots',true) +
      `<div class="screens-mini">${shots.map(s=>`<button data-shot-id="${escapeHtml(s.id)}"><img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.title)}"></button>`).join('')}</div>
       <div class="carousel-pips"><i></i><i></i><i></i><i></i><i></i></div>`;

    const news=mergedNewsList().slice(0,3);
    $('#homeNews').innerHTML = homePanelHeader('news','LATEST NEWS','#news') + news.map(n=>`
      <a class="news-mini" href="${escapeHtml(n.url||'#news')}" target="${String(n.url||'').startsWith('http')?'_blank':'_self'}">
        <div class="thumb"><img src="${escapeHtml(n.image)}" alt=""></div>
        <div class="mini-copy"><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.date)}</small></div>
      </a>`).join('');

    $('#homeMap').innerHTML = homePanelHeader('map','INTERACTIVE MAP','#map',true) +
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
        <div class="body"><h3>${escapeHtml(l.title)}</h3><div class="meta"><span>${escapeHtml(l.date)}</span><span>${escapeHtml(l.source||'')}</span></div></div>
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

  function getMapCategories(){
    return app.content.map?.categories || [
      {key:'all',label:'ALL'},
      {key:'city',label:'CITY'},
      {key:'poi',label:'POI'},
      {key:'leak',label:'LEAK'}
    ];
  }

  function renderMapFilters(){
    const filters = getMapCategories();
    $('#mapFilters').innerHTML = filters.map((f,i)=>`<button class="chip ${i===0?'active':''}" data-map-filter="${escapeHtml(f.key)}">${escapeHtml(f.label)}</button>`).join('');
    $$('.chip[data-map-filter]').forEach(b=>b.onclick=()=>{
      $$('.chip[data-map-filter]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const f=b.dataset.mapFilter;
      $$('.map-blip').forEach(x=>x.classList.toggle('hidden', f!=='all' && x.dataset.category!==f));
    });
  }

  function renderMapLegend(){
    const items = getMapCategories().filter(x=>x.key!=='all');
    $('#mapLegend').innerHTML = items.map(cat=>`<div class="legend-row"><i class="legend-pin ${mapClass(cat.key)}">${escapeHtml(cat.short||cat.label?.slice(0,3)||cat.key.toUpperCase())}</i><span>${escapeHtml(cat.legend || cat.label || cat.key)}</span></div>`).join('');
  }

  function updateMapDetail(blip){
    const detail = $('#mapDetail');
    if(!blip){ detail.innerHTML = '<b>Select a blip</b><p>Click any marker to view its details here.</p>'; return; }
    detail.innerHTML = `<b>${escapeHtml(blip.label||'Location')}</b><p>${escapeHtml(blip.description||'No description yet.')}</p>${blip.link?`<a href="${escapeHtml(blip.link)}" target="_blank" rel="noopener">OPEN LINK ↗</a>`:''}`;
    $('#mapCoords').textContent = blip.label || (app.content.map?.introLabel || 'VICE CITY & BEYOND');
  }

  function renderMap(){
    const m=app.content.map||{};
    $('#mapImage').src = m.image || 'assets/InteractiveMap/GTA6MAP.png';
    $('#mapBlips').innerHTML = (m.blips||[]).map(b=>`
      <button class="map-blip ${mapClass(b.category)}" data-id="${escapeHtml(b.id)}" data-category="${escapeHtml(b.category||'poi')}" style="left:${Number(b.x)||50}%;top:${Number(b.y)||50}%">${escapeHtml(b.symbol||'•')}</button>`).join('');
    renderMapFilters();
    renderMapLegend();
    $('#mapCoords').textContent = m.introLabel || 'VICE CITY & BEYOND';
    updateMapDetail((m.blips||[])[0]||null);
    $$('.map-blip').forEach(el=>el.onclick=e=>{
      e.stopPropagation();
      const blip = (m.blips||[]).find(x=>x.id===el.dataset.id);
      updateMapDetail(blip);
    });
  }

  function applySettings(){
    const s=app.content.settings||{};
    document.documentElement.style.setProperty('--pink', s.accent || '#ff4fa3');
    document.documentElement.style.setProperty('--cyan', s.accent2 || '#42e6ee');
    $('#globalSearch').placeholder = s.searchPlaceholder || 'Search...';
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
  function showVideo(item){
    const u=normalizeVideo(item.video||'');
    $('#videoFrameWrap').innerHTML = /\.(mp4|webm)(\?|$)/i.test(u)
      ? `<video controls autoplay src="${escapeHtml(u)}"></video>`
      : `<iframe src="${escapeHtml(u)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
    $('#videoModalTitle').textContent=item.title||'';
    $('#videoModalDate').textContent=item.date||'';
    openModal('videoModal');
  }
  function showShot(item){
    $('#lightboxImage').src=item.image;
    $('#lightboxTitle').textContent=item.title||'';
    $('#lightboxSource').textContent=item.source||'';
    openModal('lightbox');
  }

  function route(){
    const r=(location.hash||'#home').slice(1).split('?')[0];
    const valid=['home','leaks','screenshots','news','map'];
    const page=valid.includes(r)?r:'home';
    $$('.page').forEach(p=>p.classList.toggle('active', p.dataset.page===page));
    $$('.nav a').forEach(a=>a.classList.toggle('active', a.dataset.route===page));
    window.scrollTo({top:0,behavior:'instant'});
  }
  addEventListener('hashchange', route);

  let mapScale=1, mapX=0, mapY=0, drag=false, sx=0, sy=0;
  function applyMap(){ $('#mapStage').style.transform=`translate(calc(-50% + ${mapX}px), calc(-50% + ${mapY}px)) scale(${mapScale})`; }
  function resetMap(){ mapScale=1; mapX=0; mapY=0; applyMap(); }
  $('#zoomIn').onclick=()=>{ mapScale=Math.min(3,mapScale+.2); applyMap(); };
  $('#zoomOut').onclick=()=>{ mapScale=Math.max(.65,mapScale-.2); applyMap(); };
  $('#zoomReset').onclick=resetMap;
  $('#mapViewport').addEventListener('wheel',e=>{ e.preventDefault(); mapScale=Math.min(3,Math.max(.65,mapScale+(e.deltaY<0?.12:-.12))); applyMap(); }, {passive:false});
  $('#mapViewport').addEventListener('pointerdown',e=>{ if(e.target.closest('.map-blip')) return; drag=true; sx=e.clientX-mapX; sy=e.clientY-mapY; $('#mapViewport').classList.add('dragging'); e.currentTarget.setPointerCapture(e.pointerId); });
  $('#mapViewport').addEventListener('pointermove',e=>{ if(!drag) return; mapX=e.clientX-sx; mapY=e.clientY-sy; applyMap(); });
  $('#mapViewport').addEventListener('pointerup',()=>{ drag=false; $('#mapViewport').classList.remove('dragging'); });

  $('#globalSearch').addEventListener('input',e=>{
    const q=e.target.value.trim().toLowerCase();
    $$('.media-card,.shot-card,.news-item,.leak-mini,.news-mini').forEach(el=>{
      el.style.display = !q || el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  $('#profileBtn').addEventListener('click',()=>toast('Community profiles can be connected as a later module.'));
  $('#syncNewsBtn').addEventListener('click',()=>refreshFeeds({silent:false}));

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

  (async()=>{
    app.content = await loadContent();
    normalizeContent();
    renderAll();
    route();
    refreshFeeds({silent:true}).then(()=>{ renderHome(); renderNews(); }).catch(()=>{});
  })();
})();
