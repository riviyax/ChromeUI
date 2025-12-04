// newtab.js — updated with slideshow fade, robust video playback, and improved icon loader
const bgVideo = document.getElementById("bg-video");
const bgImage = document.getElementById("bg-image");
const overlayEl = document.getElementById("overlay");
const searchEl = document.getElementById("search");
const quickLinksEl = document.getElementById("quick-links");
const clockEl = document.getElementById("clock");
const greetingEl = document.getElementById("greeting");
const currentBgNameEl = document.getElementById("current-bg-name");

const audioPlayer = document.getElementById("audio-player");
const musicPlayBtn = document.getElementById("music-play");
const musicPrevBtn = document.getElementById("music-prev");
const musicNextBtn = document.getElementById("music-next");
const musicTitleEl = document.getElementById("music-title");

/* --- ensure the primary video element is prepared for autoplay policies --- */
if (bgVideo) {
  bgVideo.muted = true;
  bgVideo.setAttribute("muted", "muted");
  bgVideo.playsInline = true;
  bgVideo.setAttribute("playsinline", "");
  bgVideo.preload = "auto";
}

let state = {
  list: [], // backgrounds
  index: 0,
  current: null,
  slideshow: { enabled: false, interval: 8, timerId: null },
  quickLinks: [],
  music: { playlist: [], index: 0 },
};

/* ---------- Time / UI helpers ---------- */
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function updateClock() {
  const now = new Date();
  if (clockEl) clockEl.textContent = formatTime(now);
  const h = now.getHours();
  if (greetingEl) {
    if (h < 12) greetingEl.textContent = "Good morning!";
    else if (h < 18) greetingEl.textContent = "Good afternoon!";
    else greetingEl.textContent = "Good evening!";
  }
}
setInterval(updateClock, 1000);
updateClock();

/* ---------- Better Icon Loader (DuckDuckGo → Clearbit → FaviconKit → fallback) ---------- */

/*
  Behavior:
  - Uses a small in-memory cache to avoid re-testing the same domain
  - Tests each provider sequentially and returns the first working image URL
  - Falls back to a local default icon in your extension's assets folder
  - When rendering quick links, we set the icon to the default first (fast UI)
    and then asynchronously update it once a better icon is found.
*/

const ICON_CACHE = new Map();
const LOCAL_FALLBACK_ICON = chrome.runtime.getURL("assets/default-icon.png");

// simple image test with onload/onerror
function testImageUrl(url, timeout = 4000) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      let done = false;
      const tidy = (ok) => {
        if (done) return;
        done = true;
        img.onload = img.onerror = null;
        resolve(ok);
      };
      img.onload = () => tidy(true);
      img.onerror = () => tidy(false);
      img.src = url;

      // timeout fallback
      setTimeout(() => tidy(!!img.complete && img.naturalWidth > 0), timeout);
    } catch (e) {
      resolve(false);
    }
  });
}

// returns a best candidate icon URL for a given site URL (string)
async function getBestIconForSite(siteUrl) {
  try {
    const domain = new URL(siteUrl).hostname;
    if (!domain) return LOCAL_FALLBACK_ICON;

    // return cached
    if (ICON_CACHE.has(domain)) return ICON_CACHE.get(domain);

    // ordered sources
    const sources = [
      // DuckDuckGo ip3 favicons (good reliability)
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      // Clearbit (beautiful, often svg)
      `https://logo.clearbit.com/${domain}`,
      // FaviconKit (PNG with size)
      `https://api.faviconkit.com/${domain}/64`,
    ];

    for (const src of sources) {
      // quick test — don't block UI too long per source
      if (await testImageUrl(src, 3000)) {
        ICON_CACHE.set(domain, src);
        return src;
      }
    }

    // final fallback: local icon
    ICON_CACHE.set(domain, LOCAL_FALLBACK_ICON);
    return LOCAL_FALLBACK_ICON;
  } catch (e) {
    return LOCAL_FALLBACK_ICON;
  }
}

/* ---------- Quick Links rendering (uses the icon loader) ---------- */
function renderQuickLinks(links) {
  if (!quickLinksEl) return;
  quickLinksEl.innerHTML = "";

  const defaultIconUrl = chrome.runtime.getURL("assets/default-icon.png");

  (links || []).forEach((l) => {
    const a = document.createElement("a");
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "link";

    // icon wrapper for consistent layout
    const iconWrap = document.createElement("div");
    iconWrap.className = "link-icon-wrap";

    // create Icon Image Element and set fallback immediately for snappy UI
    const icon = document.createElement("img");
    icon.className = "link-icon";
    icon.alt = l.title || "";
    icon.loading = "lazy";
    icon.src = defaultIconUrl;

    // label text element
    const label = document.createElement("div");
    label.className = "link-label";
    label.textContent = l.title || l.url;

    // append skeleton icon + label
    iconWrap.appendChild(icon);
    a.appendChild(iconWrap);
    a.appendChild(label);
    quickLinksEl.appendChild(a);

    // asynchronously resolve the best icon and swap it in when ready
    (async () => {
      try {
        const best = await getBestIconForSite(l.url);
        // only update if src differs - avoid unnecessary DOM thrash
        if (best && icon.src !== best) {
          icon.src = best;
        }
      } catch (err) {
        // keep default icon — nothing to do
        icon.src = defaultIconUrl;
      }
    })();
  });
}

function applyOverlay(val) {
  if (!overlayEl) return;
  overlayEl.style.background = `linear-gradient(180deg, rgba(6,10,20,0.0), rgba(6,10,20,${
    val || 0.45
  }))`;
}

/* ---------- Robust video preloader + crossfade ---------- */

function preloadVideo(src) {
  return new Promise((res, rej) => {
    if (!src) return rej(new Error("no-src"));
    const tv = document.createElement("video");
    tv.muted = true;
    tv.setAttribute("muted", "muted");
    tv.playsInline = true;
    tv.setAttribute("playsinline", "");
    tv.preload = "auto";
    tv.src = src;

    const cleanup = () => {
      try {
        tv.src = "";
        tv.removeAttribute("src");
      } catch (e) {}
      tv.load && tv.load();
    };

    const onReady = () => {
      tv.removeEventListener("canplaythrough", onReady);
      tv.removeEventListener("canplay", onReady);
      tv.removeEventListener("error", onError);
      res(tv);
    };
    const onError = (e) => {
      tv.removeEventListener("canplaythrough", onReady);
      tv.removeEventListener("canplay", onReady);
      tv.removeEventListener("error", onError);
      cleanup();
      rej(e || new Error("video-preload-error"));
    };

    tv.addEventListener("canplaythrough", onReady, { once: true });
    tv.addEventListener("canplay", onReady, { once: true });
    tv.addEventListener("error", onError, { once: true });

    // safety fallback
    setTimeout(() => {
      if (tv.readyState >= 3) onReady();
      else onError(new Error("preload-timeout"));
    }, 7000);
  });
}

/* Apply background object: {type:'video'|'image'|'color', src:'', name:'', id:''} */
async function applyBackground(bg) {
  if (!bg) {
    state.current = null;
    if (bgVideo) bgVideo.classList.remove("visible");
    if (bgImage) bgImage.classList.remove("visible");
    return;
  }

  state.current = bg;
  if (currentBgNameEl) currentBgNameEl.textContent = bg.name || "Background";
  applyOverlay(bg.overlay || 0.45);

  if (bg.type === "video") {
    if (bgImage) bgImage.classList.remove("visible");

    try {
      await preloadVideo(bg.src);
      try {
        bgVideo && bgVideo.pause();
      } catch (e) {}
      if (bgVideo) {
        bgVideo.src = bg.src;
        bgVideo.load();
        bgVideo.muted = true;
        bgVideo.setAttribute("muted", "muted");
        bgVideo.setAttribute("playsinline", "");
        const playPromise = bgVideo.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              bgVideo.classList.add("visible");
            })
            .catch(() => {
              bgVideo.classList.add("visible");
            });
        } else {
          bgVideo.classList.add("visible");
        }
      }
    } catch (e) {
      // fallback attempt
      try {
        bgVideo && bgVideo.pause();
      } catch (err) {}
      if (bgVideo) {
        bgVideo.src = bg.src;
        bgVideo.load();
        bgVideo.muted = true;
        bgVideo.classList.add("visible");
        bgVideo.play().catch(() => {});
      }
    }
  } else if (bg.type === "image") {
    try {
      bgVideo && bgVideo.pause();
    } catch (e) {}
    const img = new Image();
    img.src = bg.src;
    img.onload = () => {
      if (bgImage) {
        bgImage.src = bg.src;
        bgImage.classList.add("visible");
        bgVideo && bgVideo.classList.remove("visible");
      }
    };
    img.onerror = () => {
      // do nothing
    };
  } else if (bg.type === "color") {
    try {
      bgVideo && bgVideo.pause();
    } catch (e) {}
    document.body.style.background = bg.color || "#071025";
    bgVideo && bgVideo.classList.remove("visible");
    if (bgImage) bgImage.classList.remove("visible");
  }

  // keep index in sync
  if (bg.id) {
    const idx = state.list.findIndex((x) => x.id === bg.id);
    if (idx !== -1) state.index = idx;
  }
}

/* ---------- Storage helpers ---------- */
function saveSettings(settings) {
  chrome.storage.sync.set({ chromeui_settings: settings });
}
function loadSettings() {
  return new Promise((res) => {
    chrome.storage.sync.get(["chromeui_settings"], (data) => {
      if (data && data.chromeui_settings) res(data.chromeui_settings);
      else res(null);
    });
  });
}

/* ---------- Fetch packaged configs ---------- */
async function fetchConfigs() {
  const imgs = await fetch(chrome.runtime.getURL("config/images.json")).then(
    (r) => r.json()
  );
  const vds = await fetch(chrome.runtime.getURL("config/videos.json")).then(
    (r) => r.json()
  );
  let mus = [];
  try {
    mus = await fetch(chrome.runtime.getURL("config/music.json")).then((r) =>
      r.json()
    );
  } catch (e) {}
  return { images: imgs, videos: vds, music: mus };
}

function buildList(configs, saved) {
  const list = [];
  (configs.videos || []).forEach((v) =>
    list.push({
      type: "video",
      src: chrome.runtime.getURL(v.path),
      name: v.name,
      id: v.id,
      overlay: (saved && saved.overlay) || 0.45,
    })
  );
  (configs.images || []).forEach((i) =>
    list.push({
      type: "image",
      src: chrome.runtime.getURL(i.path),
      name: i.name,
      id: i.id,
      overlay: (saved && saved.overlay) || 0.45,
    })
  );
  if (saved && saved.uploads && Array.isArray(saved.uploads)) {
    saved.uploads.forEach((u) => {
      if (!u.id) u.id = "upload-" + Date.now();
      list.unshift(u);
    });
  }
  return list;
}

/* ---------- Quick-link editor & slideshow & music code ---------- */

function renderQuickEditor(list, container) {
  if (!container) return;
  container.innerHTML = "";
  (list || []).forEach((q, idx) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";

    const title = document.createElement("input");
    title.value = q.title;
    title.style.flex = "1";
    const url = document.createElement("input");
    url.value = q.url;
    url.style.flex = "2";

    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.type = "button";
    remove.className = "btn";
    remove.addEventListener("click", () => {
      list.splice(idx, 1);
      renderQuickEditor(list, container);
      renderQuickLinks(list);
    });

    title.addEventListener("input", () => {
      list[idx].title = title.value;
      renderQuickLinks(list);
    });
    url.addEventListener("input", () => {
      list[idx].url = url.value;
      renderQuickLinks(list);
    });

    row.appendChild(title);
    row.appendChild(url);
    row.appendChild(remove);
    container.appendChild(row);
  });
}

/* SLIDESHOW control */
function startSlideshow() {
  if (state.slideshow.timerId) clearInterval(state.slideshow.timerId);
  if (!state.slideshow.enabled) return;
  state.slideshow.timerId = setInterval(async () => {
    if (!state.list || state.list.length === 0) return;
    state.index = (state.index + 1) % state.list.length;
    applyBackground(state.list[state.index]);
  }, Math.max(3000, (state.slideshow.interval || 8) * 1000));
}
function stopSlideshow() {
  if (state.slideshow.timerId) {
    clearInterval(state.slideshow.timerId);
    state.slideshow.timerId = null;
  }
}

/* MUSIC helpers */
function loadPlaylist(configMusic, saved) {
  const playlist = [];
  (configMusic || []).forEach((m) => {
    playlist.push({
      name: m.name,
      src: chrome.runtime.getURL(m.path),
      id: m.id || "music-" + m.name,
    });
  });
  if (saved && saved.uploadedAudio && Array.isArray(saved.uploadedAudio)) {
    saved.uploadedAudio.forEach((a) => playlist.unshift(a));
  }
  state.music.playlist = playlist;
  if (saved && typeof saved.musicIndex === "number")
    state.music.index = saved.musicIndex;
  updateMusicUI();
}
function updateMusicUI() {
  const active = state.music.playlist[state.music.index];
  if (musicTitleEl) musicTitleEl.textContent = active ? active.name : "";
  if (!audioPlayer) return;
  if (!audioPlayer.src || audioPlayer.src === "" || audioPlayer.paused) return;
  if (active && audioPlayer.src !== active.src) {
    audioPlayer.src = active.src;
    audioPlayer.play().catch(() => {});
  }
}
function playCurrentTrack() {
  const track = state.music.playlist[state.music.index];
  if (!track || !audioPlayer) return;
  audioPlayer.src = track.src;
  audioPlayer
    .play()
    .then(() => {
      if (musicPlayBtn) musicPlayBtn.innerHTML = '<i class="bi bi-pause"></i>';
      if (musicTitleEl) musicTitleEl.textContent = track.name;
    })
    .catch(() => {
      if (musicTitleEl) musicTitleEl.textContent = track.name;
    });
}
function togglePlayPause() {
  if (!audioPlayer) return;
  if (audioPlayer.paused) {
    if (!audioPlayer.src) {
      playCurrentTrack();
    } else {
      audioPlayer.play().catch(() => {});
    }
    if (musicPlayBtn) musicPlayBtn.innerHTML = '<i class="bi bi-pause"></i>';
  } else {
    audioPlayer.pause();
    if (musicPlayBtn) musicPlayBtn.innerHTML = '<i class="bi bi-play"></i>';
  }
}
function nextMusic() {
  if (state.music.playlist.length === 0) return;
  state.music.index = (state.music.index + 1) % state.music.playlist.length;
  playCurrentTrack();
  saveMusicIndex();
}
function prevMusic() {
  if (state.music.playlist.length === 0) return;
  state.music.index =
    (state.music.index - 1 + state.music.playlist.length) %
    state.music.playlist.length;
  playCurrentTrack();
  saveMusicIndex();
}
function saveMusicIndex() {
  loadSettings().then((s) => {
    if (!s) s = {};
    s.musicIndex = state.music.index;
    saveSettings(s);
  });
}

/* ---------- DOM wiring ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  const settingsDialog = document.getElementById("settings");
  const openSettings = document.getElementById("open-settings");
  const closeBtn = document.getElementById("close-btn");
  const saveBtn = document.getElementById("save-btn");
  const fileInput = document.getElementById("file-input");
  const overlayRange = document.getElementById("overlay-range");
  const imgSelect = document.getElementById("image-select");
  const vidSelect = document.getElementById("video-select");
  const togglePlay = document.getElementById("toggle-play");
  const prevBg = document.getElementById("prev-bg");
  const nextBg = document.getElementById("next-bg");

  const slideshowEnable = document.getElementById("slideshow-enable");
  const slideshowInterval = document.getElementById("slideshow-interval");

  const quickTitle = document.getElementById("quick-title");
  const quickUrl = document.getElementById("quick-url");
  const addQuick = document.getElementById("add-quick");
  const quickEditor = document.getElementById("quick-list-editor");

  const audioInput = document.getElementById("audio-input");
  const musicSelect = document.getElementById("music-select");

  if (openSettings) openSettings.addEventListener("click", () => settingsDialog && settingsDialog.showModal());
  if (closeBtn) closeBtn.addEventListener("click", () => settingsDialog && settingsDialog.close());

  if (searchEl) {
    searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = e.target.value.trim();
        if (!q) return;
        const url =
          q.includes(" ") || !q.includes(".")
            ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
            : q.startsWith("http")
            ? q
            : `https://${q}`;
        window.location.href = url;
      }
    });
  }

  if (togglePlay) {
    togglePlay.addEventListener("click", () => {
      if (!bgVideo) return;
      if (bgVideo.classList.contains("visible")) {
        if (bgVideo.paused) {
          bgVideo.play();
          togglePlay.innerHTML = '<i class="bi bi-pause"></i>';
        } else {
          bgVideo.pause();
          togglePlay.innerHTML = '<i class="bi bi-play"></i>';
        }
      }
    });
  }

  if (prevBg) {
    prevBg.addEventListener("click", () => {
      if (state.list.length === 0) return;
      state.index = (state.index - 1 + state.list.length) % state.list.length;
      applyBackground(state.list[state.index]);
    });
  }
  if (nextBg) {
    nextBg.addEventListener("click", () => {
      if (state.list.length === 0) return;
      state.index = (state.index + 1) % state.list.length;
      applyBackground(state.list[state.index]);
    });
  }

  // load packaged configs and saved settings
  const configs = await fetchConfigs();
  const saved = (await loadSettings()) || {};
  const list = buildList(configs, saved);
  state.list = list;

  // populate selects
  if (configs.images && imgSelect) {
    configs.images.forEach((i) => {
      const opt = document.createElement("option");
      opt.value = i.id;
      opt.textContent = i.name;
      imgSelect.appendChild(opt);
    });
  }
  if (configs.videos && vidSelect) {
    configs.videos.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      vidSelect.appendChild(opt);
    });
  }

  // music select populate
  if (configs.music && musicSelect) {
    (configs.music || []).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id || m.name;
      opt.textContent = m.name;
      musicSelect.appendChild(opt);
    });
  }

  // render quick links (defaults if missing)
  const defaults = {
    quickLinks: [
      { title: "Gmail", url: "https://mail.google.com" },
      { title: "YouTube", url: "https://www.youtube.com" },
      { title: "ChatGPT", url: "https://chatgpt.com/" },
      { title: "GitHub", url: "https://github.com" },
      { title: "Discord", url: "https://discord.com/" },
    ],
  };
  state.quickLinks = (saved && saved.quickLinks) || defaults.quickLinks;
  renderQuickLinks(state.quickLinks);

  // initial background preference
  if (saved && saved.current) {
    if (saved.current.id && saved.current.id.startsWith("default-")) {
      const found = state.list.find((x) => x.id === saved.current.id);
      if (found) {
        saved.current = Object.assign({}, found, {
          overlay: saved.overlay || found.overlay,
        });
      }
    }
    // applyBackground is async-capable
    applyBackground(saved.current);
    if (saved.current && saved.current.id) {
      const idx = state.list.findIndex((x) => x.id === saved.current.id);
      if (idx !== -1) state.index = idx;
    }
  } else if (list.length > 0) {
    state.index = 0;
    applyBackground(list[0]);
  }

  // overlay control
  if (overlayRange) {
    overlayRange.value = saved && saved.overlay ? saved.overlay : 0.45;
    applyOverlay(overlayRange.value);
  }

  // slideshow settings load
  state.slideshow.enabled = !!(
    saved &&
    saved.slideshow &&
    saved.slideshow.enabled
  );
  state.slideshow.interval =
    saved && saved.slideshow && saved.slideshow.interval
      ? saved.slideshow.interval
      : 8;
  if (slideshowEnable) slideshowEnable.checked = state.slideshow.enabled;
  if (slideshowInterval) slideshowInterval.value = state.slideshow.interval;
  if (state.slideshow.enabled) startSlideshow();

  // music setup
  loadPlaylist((configs && configs.music) || [], saved);

  // Quick editor initial render
  renderQuickEditor(state.quickLinks, quickEditor);

  // Quick add
  if (addQuick) {
    addQuick.addEventListener("click", () => {
      const t = (quickTitle && quickTitle.value.trim()) || "";
      const u = (quickUrl && quickUrl.value.trim()) || "";
      if (!t || !u) return;
      state.quickLinks.push({ title: t, url: u });
      if (quickTitle) quickTitle.value = "";
      if (quickUrl) quickUrl.value = "";
      renderQuickLinks(state.quickLinks);
      renderQuickEditor(state.quickLinks, quickEditor);
    });
  }

  // file upload handling (image/video)
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const data = evt.target.result;
        const type = f.type.startsWith("video")
          ? "video"
          : f.type.startsWith("image")
          ? "image"
          : "image";
        const item = {
          type,
          src: data,
          name: f.name,
          id: "upload-" + Date.now(),
          overlay: parseFloat(overlayRange ? overlayRange.value : 0.45),
        };
        loadSettings().then((s) => {
          if (!s) s = {};
          s.uploads = s.uploads || [];
          s.uploads.unshift(item);
          s.current = item;
          s.overlay = parseFloat(overlayRange ? overlayRange.value : 0.45);
          saveSettings(s);
          state.list.unshift(item);
          state.index = 0;
          applyBackground(item);
          settingsDialog && settingsDialog.close();
        });
      };
      reader.readAsDataURL(f);
    });
  }

  // audio upload handling
  if (audioInput) {
    audioInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const data = evt.target.result;
        const aitem = { name: f.name, src: data, id: "au-" + Date.now() };
        loadSettings().then((s) => {
          if (!s) s = {};
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
  }

  // save button handler
  if (saveBtn) {
    saveBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const selImg = imgSelect ? imgSelect.value : null;
      const selVid = vidSelect ? vidSelect.value : null;
      const overlayVal = parseFloat(overlayRange ? overlayRange.value : 0.45);
      const slideshowEnabledVal = slideshowEnable ? slideshowEnable.checked : false;
      const slideshowIntervalVal = parseInt(slideshowInterval ? slideshowInterval.value : 8) || 8;
      const selMusic = musicSelect ? musicSelect.value : null;

      loadSettings().then((s) => {
        if (!s) s = {};
        s.overlay = overlayVal;
        s.slideshow = {
          enabled: slideshowEnabledVal,
          interval: slideshowIntervalVal,
        };
        s.quickLinks = state.quickLinks;

        if (selVid && configs.videos) {
          const conf = configs.videos.find((v) => v.id === selVid);
          if (conf)
            s.current = {
              type: "video",
              src: chrome.runtime.getURL(conf.path),
              name: conf.name,
              id: conf.id,
              overlay: overlayVal,
            };
        } else if (selImg && configs.images) {
          const conf = configs.images.find((i) => i.id === selImg);
          if (conf)
            s.current = {
              type: "image",
              src: chrome.runtime.getURL(conf.path),
              name: conf.name,
              id: conf.id,
              overlay: overlayVal,
            };
        } else {
          if (s.current) s.current.overlay = overlayVal;
        }

        // set music index if user selected a packaged track
        if (selMusic) {
          const mi = (configs.music || []).findIndex(
            (m) => (m.id || m.name) === selMusic
          );
          if (mi !== -1) {
            const target = configs.music[mi];
            const src = chrome.runtime.getURL(target.path);
            const pidx = state.music.playlist.findIndex((p) => p.src === src);
            if (pidx !== -1) state.music.index = pidx;
            s.musicIndex = state.music.index;
          }
        }

        saveSettings(s);
        applyBackground(s.current);
        state.slideshow.enabled = slideshowEnabledVal;
        state.slideshow.interval = slideshowIntervalVal;
        if (state.slideshow.enabled) startSlideshow();
        else stopSlideshow();

        settingsDialog && settingsDialog.close();

        // bg toggles and spotify toggles
        const bgToggle = document.getElementById("bg-toggle");
        const bgControlls = document.querySelector(".controls-card");
        const spotifyPlayer = document.querySelector(".spotify-card");

        if (bgToggle && bgControlls) {
          if (bgToggle.checked) {
            bgControlls.style.display = "none";
            localStorage.setItem("bgHidden", "true");
          } else {
            bgControlls.style.display = "block";
            localStorage.setItem("bgHidden", "false");
          }
        }

        const spotifyToggle = document.getElementById("spotify-toggle");
        if (spotifyToggle && spotifyPlayer) {
          if (spotifyToggle.checked) {
            spotifyPlayer.style.display = "none";
            localStorage.setItem("spotifyHidden", "true");
          } else {
            spotifyPlayer.style.display = "block";
            localStorage.setItem("spotifyHidden", "false");
          }
        }
      });
    });
  }

  // load persisted hide prefs
  const bgControlls = document.querySelector(".controls-card");
  if (localStorage.getItem("bgHidden") === "true" && bgControlls) {
    bgControlls.style.display = "none";
    const bgToggle = document.getElementById("bg-toggle");
    if (bgToggle) bgToggle.checked = true;
  }
  if (localStorage.getItem("spotifyHidden") === "true") {
    const sp = document.querySelector(".spotify-card");
    if (sp) sp.style.display = "none";
    const st = document.getElementById("spotify-toggle");
    if (st) st.checked = true;
  }

  // keyboard next/prev
  document.addEventListener("keydown", (e) => {
    const nextBtn = document.getElementById("next-bg");
    const prevBtn = document.getElementById("prev-bg");
    if (e.key === "ArrowRight" && nextBtn) nextBtn.click();
    if (e.key === "ArrowLeft" && prevBtn) prevBtn.click();
  });

  // music controls wiring
  if (musicPlayBtn) musicPlayBtn.addEventListener("click", togglePlayPause);
  if (musicNextBtn) musicNextBtn.addEventListener("click", nextMusic);
  if (musicPrevBtn) musicPrevBtn.addEventListener("click", prevMusic);

  // Autoplay music check — won't autoplay unless user initiates per browser policy
  if (saved && saved.musicIndex !== undefined) {
    state.music.index = saved.musicIndex;
  }
  updateMusicUI();
});
