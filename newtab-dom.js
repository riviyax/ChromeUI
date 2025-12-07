/* --- newtab-dom.js (Full Fixed Code for Free-Form Dragging) --- */

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
  // Used for saving and loading the card positions object
  saveCardOrder, 
  loadCardOrder, 
} from "./newtab-config.js";

let configs = null; // Store configs globally for access in save button handler

/* MUSIC actions (No changes needed) */
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


/* -------------------- DRAG & DROP LOGIC (FREE-FORM ABSOLUTE) -------------------- */

// Check if drag/drop is enabled via local storage
const DRAGGABLE_CARDS = localStorage.getItem('draggableCards');

// Helper to save the current positions of cards to storage
function saveCardPositionsToStorage() {
    const cardArea = document.getElementById('card-area');
    // Select all draggable cards that have position attributes
    const cards = cardArea.querySelectorAll('#todo-card-module, #bg-controls-card, #spotify-player-card');
    
    const positions = {};
    cards.forEach(c => {
        // Only save the position if it has been set by dragging (i.e., has inline style)
        if (c.style.left && c.style.top) {
            positions[c.id] = {
                x: c.style.left,
                y: c.style.top
            };
        }
    });
    // saveCardOrder is used to store the positions object
    saveCardOrder(positions); 
}

/**
 * Sets up custom mousedown/mousemove/mouseup listeners for absolute positioning.
 * This must be defined globally to avoid the ReferenceError.
 */
function setupDragAndDrop() {
    const cardArea = document.getElementById('card-area');
    if (!cardArea) {
        console.error("Card Area not found!");
        return;
    }
    const cardSelectors = '[draggable="true"]';
    const cards = cardArea.querySelectorAll(cardSelectors);

    let draggedItem = null;
    let offsetX = 0; 
    let offsetY = 0; 

    cards.forEach(card => {
        // Ensure cards are absolutely positioned when we set up the listeners
        card.style.position = 'absolute';

        card.addEventListener('mousedown', (e) => {
            // Only proceed with left click
            if (e.button !== 0) return; 
            e.preventDefault(); 
            
            draggedItem = card;
            draggedItem.classList.add('dragging'); 
            draggedItem.style.zIndex = 1000;

            const rect = draggedItem.getBoundingClientRect();
            
            // Calculate offset relative to the viewport
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });

    function onMouseMove(e) {
        if (!draggedItem) return;

        // Calculate new position relative to the viewport
        const newX = e.clientX - offsetX;
        const newY = e.clientY - offsetY;

        // Apply new position
        draggedItem.style.left = `${newX}px`;
        draggedItem.style.top = `${newY}px`;
    }

    function onMouseUp() {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem.style.zIndex = ''; // Reset z-index
            saveCardPositionsToStorage();
        }

        draggedItem = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}
 
if (DRAGGABLE_CARDS != 'true') {
  console.log("Drag & Drop Disabled: Set 'draggableCards' in localStorage to 'true' to enable.");
}
/* ----------------------------------------------------------- */


/* ---------- DOM wiring and Initialization (FIXED) ---------- */
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
  configs = await fetchConfigs(); 
  const saved = (await loadSettings()) || {};
  const list = buildList(configs, saved);
  state.list = list;

  /* --- Populate Settings Dropdowns --- */
  
  // 1. Populate with packaged images
  if (configs.images && imgSelect) {
    configs.images.forEach((i) => {
      const opt = document.createElement("option");
      opt.value = i.id;
      opt.textContent = i.name;
      imgSelect.appendChild(opt);
    });
  }
  
  // 2. Populate with packaged videos
  if (configs.videos && vidSelect) {
    configs.videos.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      vidSelect.appendChild(opt);
    });
  }
  
  // 3. Populate with **USER UPLOADS**
  if (saved.uploads && Array.isArray(saved.uploads)) {
    saved.uploads.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `[Upload] ${item.name}`; 
      
      if (item.type === "image" && imgSelect) {
        imgSelect.appendChild(opt);
      } else if (item.type === "video" && vidSelect) {
        vidSelect.appendChild(opt);
      }
    });
  }

  // 4. Populate music select
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
  let currentBgId = null;

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
      currentBgId = saved.current.id;
      const idx = state.list.findIndex((x) => x.id === saved.current.id);
      if (idx !== -1) state.index = idx;
    }
  } else if (list.length > 0) {
    state.index = 0;
    applyBackground(list[0]);
    currentBgId = list[0].id;
  }
  
  // Select the current background in the dropdown
  if (currentBgId) {
      const currentBg = state.list.find(x => x.id === currentBgId);
      if (currentBg) {
          if (currentBg.type === 'image' && imgSelect) {
              imgSelect.value = currentBgId;
          } else if (currentBg.type === 'video' && vidSelect) {
              vidSelect.value = currentBgId;
          }
      }
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
          s.current = item; // CRITICAL: Immediately set as current
          s.overlay = parseFloat(overlayRange ? overlayRange.value : 0.45);
          saveSettings(s);
          state.list.unshift(item); // Prepend to in-memory list
          state.index = 0;
          applyBackground(item);
          
          // Update dropdown immediately after upload
          const opt = document.createElement("option");
          opt.value = item.id;
          opt.textContent = `[Upload] ${item.name}`; 
          
          if (item.type === 'image' && imgSelect) {
              imgSelect.prepend(opt);
              imgSelect.value = item.id;
              if (vidSelect) vidSelect.value = ''; // Clear video selection
          } else if (item.type === 'video' && vidSelect) {
              vidSelect.prepend(opt);
              vidSelect.value = item.id;
              if (imgSelect) imgSelect.value = ''; // Clear image selection
          }
          
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

        // 1. DETERMINE WHICH BACKGROUND WAS SELECTED
        let currentBgId = selVid || selImg;
        let currentBg = null;

        if (currentBgId) {
          currentBg = state.list.find((item) => item.id === currentBgId);
        }

        if (currentBg) {
          // 2. SAVE THE FULL OBJECT (CRITICAL FOR UPLOADS)
          s.current = {
            ...currentBg,
            overlay: overlayVal, 
          };
        } else {
          if (s.current) s.current.overlay = overlayVal;
        }

        if (configs) {
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
        }

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

  /* --- Music Controls Wiring --- */
  if (musicPlayBtn) musicPlayBtn.addEventListener("click", togglePlayPause);
  if (musicNextBtn) musicNextBtn.addEventListener("click", nextMusic);
  if (musicPrevBtn) musicPrevBtn.addEventListener("click", prevMusic);

  // Autoplay music check — updateMusicUI should be called again after wiring
  if (saved && saved.musicIndex !== undefined) {
    state.music.index = saved.musicIndex;
  }
  updateMusicUI();


  /* --------- RESTORE CARD POSITIONS (NEW LOGIC) --------- */
    // Load the saved positions object (x/y coordinates)
    const savedPositions = await loadCardOrder();
    
    // Check if the loaded data is an object of positions (not the old array format)
    if (savedPositions && typeof savedPositions === 'object' && !Array.isArray(savedPositions)) {
        Object.keys(savedPositions).forEach(id => {
            const card = document.getElementById(id);
            const pos = savedPositions[id];
            if (card && pos && pos.x && pos.y) {
                // Apply saved positions directly to style
                card.style.left = pos.x;
                card.style.top = pos.y;
                // Ensure the card has absolute positioning when positions are applied
                card.style.position = 'absolute'; 
            }
        });
    }

  // CRITICAL FIX: Setup D&D only if enabled by localStorage
  if (DRAGGABLE_CARDS == 'true') {
      setupDragAndDrop();
  }
});

/* Inside document.addEventListener("DOMContentLoaded", async () => { ... }); */

const lockToggle = document.getElementById("lock-toggle");

if (lockToggle) {
    // 1. Get the current state from localStorage
    // DRAGGABLE_CARDS is "true" or "false" (string) or null (if not set)
    const DRAGGABLE_CARDS = localStorage.getItem('draggableCards');
    
    // Set the initial toggle state: 
    // If it's explicitly "true", the toggle should be checked (unlocked state).
    // The image shows cards are draggable, so "true" = unlocked.
    // If you want the toggle to *lock* the cards, reverse the logic (i.e., true = checked/locked).
    // Based on the provided code: DRAGGABLE_CARDS == 'true' enables dragging.
    lockToggle.checked = DRAGGABLE_CARDS !== 'true'; // Checked = Locked (Dragging Disabled)

    // 2. Add the change listener
    lockToggle.addEventListener("change", () => {
        // Toggle is checked -> Dragging is disabled (Locked) -> Value is 'false'
        // Toggle is unchecked -> Dragging is enabled (Unlocked) -> Value is 'true'
        
        const isLocked = lockToggle.checked;
        const newValue = isLocked ? 'false' : 'true';

        localStorage.setItem('draggableCards', newValue);
        
        // You should prompt the user to reload for the change to take effect
        console.log(`Dragging is now set to ${newValue}. Please refresh the page.`);
        
        alert("The card lock setting has been saved. Please reload the page for the change to take effect!");
    });
}