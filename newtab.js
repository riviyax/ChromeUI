// newtab.js — updated with slideshow fade and more robust video playback
const bgVideo = document.getElementById('bg-video');
const bgImage = document.getElementById('bg-image');
const overlayEl = document.getElementById('overlay');
const searchEl = document.getElementById('search');
const quickLinksEl = document.getElementById('quick-links');
const clockEl = document.getElementById('clock');
const greetingEl = document.getElementById('greeting');
const currentBgNameEl = document.getElementById('current-bg-name');

const audioPlayer = document.getElementById('audio-player');
const musicPlayBtn = document.getElementById('music-play');
const musicPrevBtn = document.getElementById('music-prev');
const musicNextBtn = document.getElementById('music-next');
const musicTitleEl = document.getElementById('music-title');

/* --- ensure the primary video element is prepared for autoplay policies --- */
bgVideo.muted = true;
bgVideo.setAttribute('muted','muted');
bgVideo.playsInline = true;
bgVideo.setAttribute('playsinline','');
bgVideo.preload = 'auto';

let state = {
  list: [], // backgrounds
  index: 0,
  current: null,
  slideshow: { enabled: false, interval: 8, timerId: null },
  quickLinks: [],
  music: { playlist: [], index: 0 }
};

/* ---------- Time / UI helpers ---------- */
function formatTime(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function updateClock(){
  const now = new Date();
  clockEl.textContent = formatTime(now);
  const h = now.getHours();
  if(h<12) greetingEl.textContent = 'Good morning';
  else if(h<18) greetingEl.textContent = 'Good afternoon';
  else greetingEl.textContent = 'Good evening';
}
setInterval(updateClock, 1000);
updateClock();

function renderQuickLinks(links){
  quickLinksEl.innerHTML = '';
  (links||[]).forEach(l=>{
    const a = document.createElement('a');
    a.href = l.url; a.target='_blank'; a.className='link';
    a.textContent = l.title;
    quickLinksEl.appendChild(a);
  });
}

function applyOverlay(val){
  overlayEl.style.background = `linear-gradient(180deg, rgba(6,10,20,0.0), rgba(6,10,20,${val||0.45}))`;
}

/* ---------- Robust video preloader + crossfade ---------- */
/*
 Approach:
 1. Create a temp <video> to preload the next video src (muted & playsinline).
 2. Wait for canplaythrough (or canplay) on the temp video.
 3. When ready, swap the main bgVideo.src to the ready source, call load(), then play() and add .visible class.
 4. For images, we use Image() to preload and then add .visible class.
 5. CSS handles opacity transitions for fade in/out.
*/

function preloadVideo(src){
  return new Promise((res, rej)=>{
    // If it's already the current src and bgVideo is ready, resolve immediately
    if(!src) return rej(new Error('no-src'));
    // create temp video element for preloading
    const tv = document.createElement('video');
    tv.muted = true;
    tv.setAttribute('muted','muted');
    tv.playsInline = true;
    tv.setAttribute('playsinline','');
    tv.preload = 'auto';
    tv.src = src;

    // If the browser already has this cached it may fire quickly
    const cleanup = ()=>{
      try{ tv.src = ''; tv.removeAttribute('src'); }catch(e){}
      tv.load && tv.load();
    };

    const onReady = ()=>{
      tv.removeEventListener('canplaythrough', onReady);
      tv.removeEventListener('canplay', onReady);
      tv.removeEventListener('error', onError);
      res(tv);
    };
    const onError = (e)=>{
      tv.removeEventListener('canplaythrough', onReady);
      tv.removeEventListener('canplay', onReady);
      tv.removeEventListener('error', onError);
      cleanup();
      rej(e || new Error('video-preload-error'));
    };

    tv.addEventListener('canplaythrough', onReady, {once:true});
    tv.addEventListener('canplay', onReady, {once:true});
    tv.addEventListener('error', onError, {once:true});

    // Safety fallback if neither event fires after X ms (attempt can still resolve earlier)
    setTimeout(()=> {
      // try to proceed if metadata loaded at least
      if(tv.readyState >= 3) onReady();
      else onError(new Error('preload-timeout'));
    }, 7000);
  });
}

/* Apply background object: {type:'video'|'image'|'color', src:'', name:'', id:''} */
async function applyBackground(bg){
  if(!bg){
    state.current = null;
    // fade out both
    bgVideo.classList.remove('visible');
    if(bgImage) bgImage.classList.remove('visible');
    return;
  }

  state.current = bg;
  currentBgNameEl.textContent = bg.name || 'Background';
  applyOverlay(bg.overlay || 0.45);

  // If the new background is a video, preload it, then swap and fade in.
  if(bg.type === 'video'){
    // prepare UI: hide image if visible
    if(bgImage) bgImage.classList.remove('visible');

    try{
      // Preload next video using a temp video element
      const tv = await preloadVideo(bg.src);
      // temp video ready — swap into main video element
      // Pause main video, set src, load and play
      try{ bgVideo.pause(); }catch(e){}
      // small fix: set attribute and use load() for reliability
      bgVideo.src = bg.src;
      bgVideo.load();
      // ensure muted & playsinline
      bgVideo.muted = true;
      bgVideo.setAttribute('muted','muted');
      bgVideo.setAttribute('playsinline','');
      // play; if autoplay blocked, we still add visible so user sees it, and will allow play on interaction
      const playPromise = bgVideo.play();
      if(playPromise !== undefined){
        playPromise.then(()=> {
          bgVideo.classList.add('visible');
        }).catch(()=> {
          // autoplay blocked — still show the faded video element (muted) but it may not play audio
          bgVideo.classList.add('visible');
        });
      } else {
        bgVideo.classList.add('visible');
      }
    }catch(e){
      // Preload failed — try a direct fallback: set src and attempt to play
      try{ bgVideo.pause(); }catch(_){}
      bgVideo.src = bg.src;
      bgVideo.load();
      bgVideo.muted = true;
      bgVideo.classList.add('visible');
      bgVideo.play().catch(()=>{ /* silent fallback */ });
    }
  } else if(bg.type === 'image'){
    // For images we preload the image before showing to produce a fade
    try{ bgVideo.pause(); }catch(e){}
    const img = new Image();
    img.src = bg.src;
    img.onload = ()=>{
      if(bgImage){
        bgImage.src = bg.src;
        bgImage.classList.add('visible');
        // hide video (fade) after image visible
        bgVideo.classList.remove('visible');
      }
    };
    img.onerror = ()=>{
      // image failed — do nothing
    };
  } else if(bg.type === 'color'){
    try{ bgVideo.pause(); }catch(e){}
    document.body.style.background = bg.color || '#071025';
    bgVideo.classList.remove('visible');
    if(bgImage) bgImage.classList.remove('visible');
  }

  // keep index in sync with applied background (if it exists in list)
  if(bg.id){
    const idx = state.list.findIndex(x => x.id === bg.id);
    if(idx !== -1) state.index = idx;
  }
}

/* ---------- Storage helpers ---------- */
function saveSettings(settings){
  chrome.storage.sync.set({chromeui_settings: settings});
}
function loadSettings(){
  return new Promise(res=>{
    chrome.storage.sync.get(['chromeui_settings'], data=>{
      if(data && data.chromeui_settings) res(data.chromeui_settings);
      else res(null);
    });
  });
}

/* ---------- Fetch packaged configs ---------- */
async function fetchConfigs(){
  const imgs = await fetch(chrome.runtime.getURL('config/images.json')).then(r=>r.json());
  const vds = await fetch(chrome.runtime.getURL('config/videos.json')).then(r=>r.json());
  let mus = [];
  try{
    mus = await fetch(chrome.runtime.getURL('config/music.json')).then(r=>r.json());
  }catch(e){}
  return {images: imgs, videos: vds, music: mus};
}

function buildList(configs, saved){
  const list = [];
  (configs.videos||[]).forEach(v=> list.push({type:'video', src: chrome.runtime.getURL(v.path), name: v.name, id:v.id, overlay: (saved && saved.overlay) || 0.45}));
  (configs.images||[]).forEach(i=> list.push({type:'image', src: chrome.runtime.getURL(i.path), name: i.name, id:i.id, overlay: (saved && saved.overlay) || 0.45}));
  if(saved && saved.uploads && Array.isArray(saved.uploads)){
    saved.uploads.forEach(u=> {
      if(!u.id) u.id = 'upload-' + Date.now();
      list.unshift(u);
    });
  }
  return list;
}

/* ---------- Quick-link editor & slideshow & music code ---------- */
/* (kept the same as your previous code with small changes to call applyBackground async) */

/* QUICK-LINK EDITOR helpers */
function renderQuickEditor(list, container){
  container.innerHTML = '';
  (list||[]).forEach((q, idx)=>{
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';

    const title = document.createElement('input');
    title.value = q.title; title.style.flex='1';
    const url = document.createElement('input');
    url.value = q.url; url.style.flex='2';

    const remove = document.createElement('button');
    remove.textContent = '✕'; remove.type='button'; remove.className='btn';
    remove.addEventListener('click', ()=> {
      list.splice(idx,1);
      renderQuickEditor(list, container);
    });

    // update values live
    title.addEventListener('input', ()=> { list[idx].title = title.value; renderQuickLinks(list); });
    url.addEventListener('input', ()=> { list[idx].url = url.value; renderQuickLinks(list); });

    row.appendChild(title); row.appendChild(url); row.appendChild(remove);
    container.appendChild(row);
  });
}

/* SLIDESHOW control */
function startSlideshow(){
  if(state.slideshow.timerId) clearInterval(state.slideshow.timerId);
  if(!state.slideshow.enabled) return;
  state.slideshow.timerId = setInterval(async ()=> {
    if(!state.list || state.list.length===0) return;
    state.index = (state.index + 1) % state.list.length;
    // applyBackground is async but we don't need to await here
    applyBackground(state.list[state.index]);
  }, Math.max(3000, (state.slideshow.interval||8)*1000));
}
function stopSlideshow(){
  if(state.slideshow.timerId) { clearInterval(state.slideshow.timerId); state.slideshow.timerId = null; }
}

/* MUSIC helpers (unchanged behavior) */
function loadPlaylist(configMusic, saved){
  const playlist = [];
  (configMusic||[]).forEach(m => {
    playlist.push({name: m.name, src: chrome.runtime.getURL(m.path), id: m.id || ('music-' + m.name)});
  });
  if(saved && saved.uploadedAudio && Array.isArray(saved.uploadedAudio)) {
    saved.uploadedAudio.forEach(a => playlist.unshift(a));
  }
  state.music.playlist = playlist;
  if(saved && typeof saved.musicIndex === 'number') state.music.index = saved.musicIndex;
  updateMusicUI();
}
function updateMusicUI(){
  const active = state.music.playlist[state.music.index];
  musicTitleEl.textContent = active ? active.name : '';
  if(!audioPlayer.src || audioPlayer.src === '' || audioPlayer.paused) return;
  if(active && audioPlayer.src !== active.src) {
    audioPlayer.src = active.src;
    audioPlayer.play().catch(()=>{});
  }
}
function playCurrentTrack(){
  const track = state.music.playlist[state.music.index];
  if(!track) return;
  audioPlayer.src = track.src;
  audioPlayer.play().then(()=> {
    musicPlayBtn.innerHTML = '<i class="bi bi-pause"></i>';
    musicTitleEl.textContent = track.name;
  }).catch(()=> {
    musicTitleEl.textContent = track.name;
  });
}
function togglePlayPause(){
  if(audioPlayer.paused){
    if(!audioPlayer.src){
      playCurrentTrack();
    } else {
      audioPlayer.play().catch(()=>{});
    }
    musicPlayBtn.innerHTML = '<i class="bi bi-pause"></i>';
  } else {
    audioPlayer.pause();
    musicPlayBtn.innerHTML = '<i class="bi bi-play"></i>';
  }
}
function nextMusic(){
  if(state.music.playlist.length===0) return;
  state.music.index = (state.music.index + 1) % state.music.playlist.length;
  playCurrentTrack();
  saveMusicIndex();
}
function prevMusic(){
  if(state.music.playlist.length===0) return;
  state.music.index = (state.music.index - 1 + state.music.playlist.length) % state.music.playlist.length;
  playCurrentTrack();
  saveMusicIndex();
}
function saveMusicIndex(){
  loadSettings().then(s=>{
    if(!s) s = {};
    s.musicIndex = state.music.index;
    saveSettings(s);
  });
}

/* ---------- DOM wiring (kept your original wiring but updated to use new applyBackground signature) ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  const settingsDialog = document.getElementById('settings');
  const openSettings = document.getElementById('open-settings');
  const closeBtn = document.getElementById('close-btn');
  const saveBtn = document.getElementById('save-btn');
  const fileInput = document.getElementById('file-input');
  const overlayRange = document.getElementById('overlay-range');
  const imgSelect = document.getElementById('image-select');
  const vidSelect = document.getElementById('video-select');
  const togglePlay = document.getElementById('toggle-play');
  const prevBg = document.getElementById('prev-bg');
  const nextBg = document.getElementById('next-bg');

  const slideshowEnable = document.getElementById('slideshow-enable');
  const slideshowInterval = document.getElementById('slideshow-interval');

  const quickTitle = document.getElementById('quick-title');
  const quickUrl = document.getElementById('quick-url');
  const addQuick = document.getElementById('add-quick');
  const quickEditor = document.getElementById('quick-list-editor');

  const audioInput = document.getElementById('audio-input');
  const musicSelect = document.getElementById('music-select');

  openSettings.addEventListener('click', ()=> settingsDialog.showModal());
  closeBtn.addEventListener('click', ()=> settingsDialog.close());

  searchEl.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      const q = e.target.value.trim();
      if(!q) return;
      const url = q.includes(' ') || !q.includes('.') ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : q.startsWith('http') ? q : `https://${q}`;
      window.location.href = url;
    }
  });

  togglePlay.addEventListener('click', ()=>{
    if(bgVideo.classList.contains('visible')){
      if(bgVideo.paused){ bgVideo.play(); togglePlay.innerHTML='<i class="bi bi-pause"></i>'; }
      else { bgVideo.pause(); togglePlay.innerHTML='<i class="bi bi-play"></i>'; }
    }
  });
  prevBg.addEventListener('click', ()=>{
    if(state.list.length===0) return;
    state.index = (state.index - 1 + state.list.length) % state.list.length;
    applyBackground(state.list[state.index]);
  });
  nextBg.addEventListener('click', ()=>{
    if(state.list.length===0) return;
    state.index = (state.index + 1) % state.list.length;
    applyBackground(state.list[state.index]);
  });

  // load packaged configs and saved settings
  const configs = await fetchConfigs();
  const saved = await loadSettings() || {};
  const list = buildList(configs, saved);
  state.list = list;

  // populate selects
  configs.images.forEach(i => {
    const opt = document.createElement('option'); opt.value = i.id; opt.textContent = i.name; imgSelect.appendChild(opt);
  });
  configs.videos.forEach(v => {
    const opt = document.createElement('option'); opt.value = v.id; opt.textContent = v.name; vidSelect.appendChild(opt);
  });

  // music select populate
  (configs.music||[]).forEach(m => {
    const opt = document.createElement('option'); opt.value = m.id || m.name; opt.textContent = m.name; musicSelect.appendChild(opt);
  });

  // render quick links (defaults if missing)
  const defaults = { quickLinks: [ {title:'Gmail',url:'https://mail.google.com'}, {title:'YouTube',url:'https://www.youtube.com'}, {title:'GitHub',url:'https://github.com'} ] };
  state.quickLinks = (saved && saved.quickLinks) || defaults.quickLinks;
  renderQuickLinks(state.quickLinks);

  // initial background preference
  if(saved && saved.current){
    if(saved.current.id && saved.current.id.startsWith('default-')){
      const found = state.list.find(x => x.id === saved.current.id);
      if(found){ saved.current = Object.assign({}, found, {overlay: saved.overlay || found.overlay}); }
    }
    // applyBackground is async-capable
    applyBackground(saved.current);
    if(saved.current && saved.current.id){
      const idx = state.list.findIndex(x => x.id === saved.current.id);
      if(idx !== -1) state.index = idx;
    }
  } else if(list.length>0){
    state.index = 0;
    applyBackground(list[0]);
  }

  // overlay control
  overlayRange.value = (saved && saved.overlay) ? saved.overlay : 0.45;
  applyOverlay(overlayRange.value);

  // slideshow settings load
  state.slideshow.enabled = !!(saved && saved.slideshow && saved.slideshow.enabled);
  state.slideshow.interval = (saved && saved.slideshow && saved.slideshow.interval) ? saved.slideshow.interval : 8;
  slideshowEnable.checked = state.slideshow.enabled;
  slideshowInterval.value = state.slideshow.interval;
  if(state.slideshow.enabled) startSlideshow();

  // music setup
  loadPlaylist(configs.music || [], saved);

  // Quick editor initial render
  renderQuickEditor(state.quickLinks, quickEditor);

  // Quick add
  addQuick.addEventListener('click', ()=>{
    const t = quickTitle.value.trim(); const u = quickUrl.value.trim();
    if(!t || !u) return;
    state.quickLinks.push({title:t, url:u});
    quickTitle.value = ''; quickUrl.value = '';
    renderQuickLinks(state.quickLinks);
    renderQuickEditor(state.quickLinks, quickEditor);
  });

  // file upload handling (image/video)
  fileInput.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      const data = evt.target.result;
      const type = f.type.startsWith('video') ? 'video' : (f.type.startsWith('image') ? 'image' : 'image');
      const item = {type, src: data, name: f.name, id: 'upload-' + Date.now(), overlay: parseFloat(overlayRange.value)};
      loadSettings().then(s=>{
        if(!s) s = {};
        s.uploads = s.uploads || [];
        s.uploads.unshift(item);
        s.current = item;
        s.overlay = parseFloat(overlayRange.value);
        saveSettings(s);
        state.list.unshift(item);
        state.index = 0;
        applyBackground(item);
        settingsDialog.close();
      });
    };
    reader.readAsDataURL(f);
  });

  // audio upload handling
  audioInput.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      const data = evt.target.result;
      const aitem = {name: f.name, src: data, id: 'au-' + Date.now()};
      loadSettings().then(s=>{
        if(!s) s = {};
        s.uploadedAudio = s.uploadedAudio || [];
        s.uploadedAudio.unshift(aitem);
        saveSettings(s);
        // add to playlist in-memory and start using
        state.music.playlist.unshift(aitem);
        state.music.index = 0;
        playCurrentTrack();
      });
    };
    reader.readAsDataURL(f);
  });

  // save button handler
  saveBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    const selImg = imgSelect.value;
    const selVid = vidSelect.value;
    const overlayVal = parseFloat(overlayRange.value);
    const slideshowEnabledVal = slideshowEnable.checked;
    const slideshowIntervalVal = parseInt(slideshowInterval.value) || 8;
    const selMusic = musicSelect.value;

    loadSettings().then(s=>{
      if(!s) s = {};
      s.overlay = overlayVal;
      s.slideshow = { enabled: slideshowEnabledVal, interval: slideshowIntervalVal };
      s.quickLinks = state.quickLinks;

      if(selVid){
        const conf = configs.videos.find(v=>v.id===selVid);
        if(conf) s.current = {type:'video', src: chrome.runtime.getURL(conf.path), name: conf.name, id: conf.id, overlay: overlayVal};
      } else if(selImg){
        const conf = configs.images.find(i=>i.id===selImg);
        if(conf) s.current = {type:'image', src: chrome.runtime.getURL(conf.path), name: conf.name, id: conf.id, overlay: overlayVal};
      } else {
        if(s.current) s.current.overlay = overlayVal;
      }

      // if user picked a packaged music track, set the music index to that
      if(selMusic){
        const mi = (configs.music||[]).findIndex(m=> (m.id||m.name) === selMusic);
        if(mi !== -1){
          const target = configs.music[mi];
          const src = chrome.runtime.getURL(target.path);
          const pidx = state.music.playlist.findIndex(p => p.src === src);
          if(pidx !== -1) state.music.index = pidx;
          s.musicIndex = state.music.index;
        }
      }

      saveSettings(s);
      applyBackground(s.current);
      state.slideshow.enabled = slideshowEnabledVal;
      state.slideshow.interval = slideshowIntervalVal;
      if(state.slideshow.enabled) startSlideshow(); else stopSlideshow();

      settingsDialog.close();
    });
  });

  // keyboard next/prev
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowRight') nextBg.click();
    if(e.key === 'ArrowLeft') prevBg.click();
  });

  // music controls wiring
  musicPlayBtn.addEventListener('click', togglePlayPause);
  musicNextBtn.addEventListener('click', nextMusic);
  musicPrevBtn.addEventListener('click', prevMusic);

  // audio event to advance track
  audioPlayer.addEventListener('ended', ()=> {
    nextMusic();
  });

  // If autoplay blocked, allow a user gesture to start video/audio playback by clicking anywhere
  const tryResumeMedia = ()=> {
    // try background video
    if(bgVideo && bgVideo.paused && bgVideo.src){
      bgVideo.play().catch(()=>{});
    }
    // try audio
    if(audioPlayer && audioPlayer.paused && audioPlayer.src){
      audioPlayer.play().catch(()=>{});
    }
    // remove after first attempt to avoid repeated tries
    document.removeEventListener('click', tryResumeMedia);
  };
  document.addEventListener('click', tryResumeMedia);

  // initial UI updates
  renderQuickLinks(state.quickLinks);
  renderQuickEditor(state.quickLinks, quickEditor);
  updateMusicUI();
});

const playlists = [
    "https://open.spotify.com/embed/playlist/37i9dQZF1DWYfNJLV7OBMA?utm_source=generator",
    "https://open.spotify.com/embed/playlist/372vscw9O87WnUqQtt9jL9?utm_source=generator",
    "https://open.spotify.com/embed/playlist/75UpUntyozjrqR03Xza9MG?utm_source=generator",
    "https://open.spotify.com/embed/playlist/4kOdiP5gbzocwxQ8s2UTOF?utm_source=generator",
  ];

  let currentIndex = 0;

  const player = document.getElementById("spotify-player");
  const prevBtn = document.getElementById("spotify-prev");
  const nextBtn = document.getElementById("spotify-next");

  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + playlists.length) % playlists.length;
    player.src = playlists[currentIndex];
  });

  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % playlists.length;
    player.src = playlists[currentIndex];
  });