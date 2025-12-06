/* --- newtab-dom.js --- */
import {
  state,
  bgVideo,
  audioPlayer,
  searchEl,
  musicPlayBtn,
  musicNextBtn,
  musicPrevBtn,
  musicTitleEl,
  applyBackground,
  applyOverlay,
  renderQuickLinks,
  startSlideshow,
  stopSlideshow,
} from "./newtab-core.js";

import {
  saveSettings,
  loadSettings,
  fetchConfigs,
  buildList,
  loadPlaylist,
  saveMusicIndex,
} from "./newtab-config.js";

let configs = null; // Store configs globally for access in save button handler

/* MUSIC actions */
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

/* Quick-link editor rendering/interaction (only used in settings dialog) */
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
      renderQuickEditor(list, container); // Re-render the editor after removal
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

/* ---------- DOM wiring and Initialization ---------- */
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

  if (openSettings)
    openSettings.addEventListener("click", () => settingsDialog && settingsDialog.showModal());
  if (closeBtn)
    closeBtn.addEventListener("click", () => settingsDialog && settingsDialog.close());

  /* --- Search Bar --- */
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

  /* --- Background Controls (Video Pause/Play, Prev/Next) --- */
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
  configs = await fetchConfigs(); // Save to global scope for use in saveBtn
  const saved = (await loadSettings()) || {};
  const list = buildList(configs, saved);
  state.list = list;

  /* --- Populate Settings Dropdowns --- */
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
  if (configs.music && musicSelect) {
    (configs.music || []).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id || m.name;
      opt.textContent = m.name;
      musicSelect.appendChild(opt);
    });
  }

  /* --- Quick Links Initial Render --- */
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

  /* --- Initial Background/Overlay/Slideshow Setup --- */
  if (saved && saved.current) {
    // Logic to ensure saved.current matches an item in state.list if it's a default one
    if (saved.current.id && saved.current.id.startsWith("default-")) {
      const found = state.list.find((x) => x.id === saved.current.id);
      if (found) {
        saved.current = Object.assign({}, found, {
          overlay: saved.overlay || found.overlay,
        });
      }
    }
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

  /* --- Music Player Setup --- */
  loadPlaylist((configs && configs.music) || [], saved);
  updateMusicUI(); // Initial title setup

  /* --- Quick Editor Interaction --- */
  renderQuickEditor(state.quickLinks, quickEditor);

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

  /* --- File Upload Handling (Background) --- */
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
          s.uploads.unshift(item); // Prepend to saved uploads
          s.current = item;
          s.overlay = parseFloat(overlayRange ? overlayRange.value : 0.45);
          saveSettings(s);
          state.list.unshift(item); // Prepend to in-memory list
          state.index = 0;
          applyBackground(item);
          settingsDialog && settingsDialog.close();
        });
      };
      reader.readAsDataURL(f);
    });
  }

  /* --- Audio Upload Handling --- */
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

  /* --- Save Button Handler --- */
  if (saveBtn) {
    saveBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const selImg = imgSelect ? imgSelect.value : null;
      const selVid = vidSelect ? vidSelect.value : null;
      const overlayVal = parseFloat(overlayRange ? overlayRange.value : 0.45);
      const slideshowEnabledVal = slideshowEnable ? slideshowEnable.checked : false;
      const slideshowIntervalVal =
        parseInt(slideshowInterval ? slideshowInterval.value : 8) || 8;
      const selMusic = musicSelect ? musicSelect.value : null;

      loadSettings().then((s) => {
        if (!s) s = {};
        s.overlay = overlayVal;
        s.slideshow = {
          enabled: slideshowEnabledVal,
          interval: slideshowIntervalVal,
        };
        s.quickLinks = state.quickLinks;

        if (configs) {
          // Update current background setting
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

          // Set music index if user selected a packaged track
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
        } // end if (configs)

        saveSettings(s);

        // Apply new settings to the live page
        applyBackground(s.current);
        state.slideshow.enabled = slideshowEnabledVal;
        state.slideshow.interval = slideshowIntervalVal;
        if (state.slideshow.enabled) startSlideshow();
        else stopSlideshow();

        settingsDialog && settingsDialog.close();

        // Handle visibility toggles
        const bgToggle = document.getElementById("bg-toggle");
        const bgControlls = document.querySelector(".controls-card");
        const spotifyToggle = document.getElementById("spotify-toggle");
        const spotifyPlayer = document.querySelector(".spotify-card");
        const todoToggle = document.getElementById("todo-toggle");
        const todoList = document.querySelector(".todo-card");

        if (bgToggle && bgControlls) {
          bgControlls.style.display = bgToggle.checked ? "none" : "block";
          localStorage.setItem("bgHidden", bgToggle.checked);
        }

        if (spotifyToggle && spotifyPlayer) {
          spotifyPlayer.style.display = spotifyToggle.checked ? "none" : "block";
          localStorage.setItem("spotifyHidden", spotifyToggle.checked);
        }

        if (todoToggle && todoList) {
          todoList.style.display = todoToggle.checked ? "none" : "block";
          localStorage.setItem("todoHidden", todoToggle.checked);
        }
      });
    });
  }

  /* --- Load Persisted Hide Preferences (Local Storage) --- */
  const bgControlls = document.querySelector(".controls-card");
  if (localStorage.getItem("bgHidden") === "true" && bgControlls) {
    bgControlls.style.display = "none";
    const bgToggle = document.getElementById("bg-toggle");
    if (bgToggle) bgToggle.checked = true;
  }
  const sp = document.querySelector(".spotify-card");
  if (localStorage.getItem("spotifyHidden") === "true" && sp) {
    sp.style.display = "none";
    const st = document.getElementById("spotify-toggle");
    if (st) st.checked = true;
  }
  const todoList = document.querySelector(".todo-card");
  if (localStorage.getItem("todoHidden") === "true" && todoList) {
    todoList.style.display = "none";
    const tt = document.getElementById("todo-toggle");
    if (tt) tt.checked = true;
  }

  /* --- Keyboard Shortcuts --- */
  // document.addEventListener("keydown", (e) => {
  //   const nextBtn = document.getElementById("next-bg");
  //   const prevBtn = document.getElementById("prev-bg");
  //   if (e.key === "ArrowRight" && nextBtn) nextBtn.click();
  //   if (e.key === "ArrowLeft" && prevBtn) prevBtn.click();
  // });

  /* --- Music Controls Wiring --- */
  if (musicPlayBtn) musicPlayBtn.addEventListener("click", togglePlayPause);
  if (musicNextBtn) musicNextBtn.addEventListener("click", nextMusic);
  if (musicPrevBtn) musicPrevBtn.addEventListener("click", prevMusic);

  // Autoplay music check — updateMusicUI should be called again after wiring
  // to ensure correct state if a track was previously playing.
  if (saved && saved.musicIndex !== undefined) {
    state.music.index = saved.musicIndex;
  }
  updateMusicUI();
});