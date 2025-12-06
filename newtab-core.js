/* --- newtab-core.js --- */

// DOM Element References (exported for other modules)
export const bgVideo = document.getElementById("bg-video");
export const bgImage = document.getElementById("bg-image");
export const overlayEl = document.getElementById("overlay");
export const searchEl = document.getElementById("search");
export const quickLinksEl = document.getElementById("quick-links");
export const clockEl = document.getElementById("clock");
export const greetingEl = document.getElementById("greeting");
export const currentBgNameEl = document.getElementById("current-bg-name");

export const audioPlayer = document.getElementById("audio-player");
export const musicPlayBtn = document.getElementById("music-play");
export const musicPrevBtn = document.getElementById("music-prev");
export const musicNextBtn = document.getElementById("music-next");
export const musicTitleEl = document.getElementById("music-title");

/* --- ensure the primary video element is prepared for autoplay policies --- */
if (bgVideo) {
  bgVideo.muted = true;
  bgVideo.setAttribute("muted", "muted");
  bgVideo.playsInline = true;
  bgVideo.setAttribute("playsinline", "");
  bgVideo.preload = "auto";
}

export let state = {
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

export function updateClock() {
  const now = new Date();
  if (clockEl) clockEl.textContent = formatTime(now);
  const h = now.getHours();
  if (greetingEl) {
    if (h < 12) greetingEl.textContent = "Good morning!";
    else if (h < 18) greetingEl.textContent = "Good afternoon!";
    else greetingEl.textContent = "Good evening!";
  }
}

// Initial call and interval setup
setInterval(updateClock, 1000);
updateClock();

/* ---------- Better Icon Loader ---------- */
const ICON_CACHE = new Map();
export const LOCAL_FALLBACK_ICON = chrome.runtime.getURL("assets/default-icon.png");

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
export async function getBestIconForSite(siteUrl) {
  try {
    const domain = new URL(siteUrl).hostname;
    if (!domain) return LOCAL_FALLBACK_ICON;

    // return cached
    if (ICON_CACHE.has(domain)) return ICON_CACHE.get(domain);

    // ordered sources
    const sources = [
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://logo.clearbit.com/${domain}`,
      `https://api.faviconkit.com/${domain}/64`,
    ];

    for (const src of sources) {
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
export function renderQuickLinks(links) {
  if (!quickLinksEl) return;
  quickLinksEl.innerHTML = "";

  const defaultIconUrl = LOCAL_FALLBACK_ICON;

  (links || []).forEach((l) => {
    const a = document.createElement("a");
    a.href = l.url;
    a.target = "";
    a.rel = "noopener noreferrer";
    a.className = "link";

    const iconWrap = document.createElement("div");
    iconWrap.className = "link-icon-wrap";

    const icon = document.createElement("img");
    icon.className = "link-icon";
    icon.alt = l.title || "";
    icon.loading = "lazy";
    icon.src = defaultIconUrl;

    const label = document.createElement("div");
    label.className = "link-label";
    label.textContent = l.title || l.url;

    iconWrap.appendChild(icon);
    a.appendChild(iconWrap);
    a.appendChild(label);
    quickLinksEl.appendChild(a);

    // asynchronously resolve the best icon
    getBestIconForSite(l.url)
      .then((best) => {
        if (best && icon.src !== best) {
          icon.src = best;
        }
      })
      .catch(() => {
        icon.src = defaultIconUrl;
      });
  });
}

export function applyOverlay(val) {
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
export async function applyBackground(bg) {
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

/* SLIDESHOW control */
export function startSlideshow() {
  if (state.slideshow.timerId) clearInterval(state.slideshow.timerId);
  if (!state.slideshow.enabled) return;
  state.slideshow.timerId = setInterval(async () => {
    if (!state.list || state.list.length === 0) return;
    state.index = (state.index + 1) % state.list.length;
    applyBackground(state.list[state.index]);
  }, Math.max(3000, (state.slideshow.interval || 8) * 1000));
}

export function stopSlideshow() {
  if (state.slideshow.timerId) {
    clearInterval(state.slideshow.timerId);
    state.slideshow.timerId = null;
  }
}