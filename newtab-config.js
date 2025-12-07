/* --- newtab-config.js --- */
import { state } from './newtab-core.js';

/* ---------- Storage helpers ---------- */
export function saveSettings(settings) {
  chrome.storage.sync.set({ chromeui_settings: settings });
}

export function loadSettings() {
  return new Promise((res) => {
    chrome.storage.sync.get(["chromeui_settings"], (data) => {
      if (data && data.chromeui_settings) res(data.chromeui_settings);
      else res(null);
    });
  });
}

/* ---------- Fetch packaged configs ---------- */
export async function fetchConfigs() {
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

export function buildList(configs, saved) {
  const list = [];
  const overlayVal = (saved && saved.overlay) || 0.45;

  (configs.videos || []).forEach((v) =>
    list.push({
      type: "video",
      src: chrome.runtime.getURL(v.path),
      name: v.name,
      id: v.id,
      overlay: overlayVal,
    })
  );
  (configs.images || []).forEach((i) =>
    list.push({
      type: "image",
      src: chrome.runtime.getURL(i.path),
      name: i.name,
      id: i.id,
      overlay: overlayVal,
    })
  );
  if (saved && saved.uploads && Array.isArray(saved.uploads)) {
    // uploaded backgrounds (images/videos)
    // CRITICAL: Ensure uploaded items are added to the list for the save handler to find them.
    saved.uploads.forEach((u) => {
      if (!u.id) u.id = "upload-" + Date.now();
      list.unshift(u);
    });
  }
  return list;
}

/* MUSIC helpers */
export function saveMusicIndex() {
  loadSettings().then((s) => {
    if (!s) s = {};
    s.musicIndex = state.music.index;
    saveSettings(s);
  });
}

export function loadPlaylist(configMusic, saved) {
  const playlist = [];
  (configMusic || []).forEach((m) => {
    playlist.push({
      name: m.name,
      src: chrome.runtime.getURL(m.path),
      id: m.id || "music-" + m.name,
    });
  });
  if (saved && saved.uploadedAudio && Array.isArray(saved.uploadedAudio)) {
    // uploaded audio tracks
    saved.uploadedAudio.forEach((a) => playlist.unshift(a));
  }
  state.music.playlist = playlist;
  if (saved && typeof saved.musicIndex === "number")
    state.music.index = saved.musicIndex;
}


export function saveCardOrder(order) {
    // Saves the array of card IDs (e.g., ['todo-card-module', 'bg-controls-card', 'spotify-player-card'])
    chrome.storage.sync.set({ chromeui_card_order: order });
}

export function loadCardOrder() {
    return new Promise((res) => {
        chrome.storage.sync.get(["chromeui_card_order"], (data) => {
            // Returns the saved array of IDs, or null if none exist
            res(data.chromeui_card_order || null);
        });
    });
}