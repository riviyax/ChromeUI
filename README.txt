
ChromeUI — Dashboard new tab (Style B)
-------------------------------------
What's included:
- Dashboard-style new tab with clock, greeting, search, quick links
- Background support for packaged images/videos and uploaded media
- Config files in /config (images.json, videos.json) for easy editing
- Settings modal that allows selecting defaults and uploading media (saved to chrome.storage.sync)

Structure:
ChromeUI/
 ├── manifest.json
 ├── newtab.html
 ├── newtab.js
 ├── styles.css
 ├── options.html
 ├── assets/images/*.jpg
 ├── assets/videos/ (place mp4 files here for defaults)
 ├── config/images.json
 └── config/videos.json

Notes:
- Uploads are stored in chrome.storage.sync as data URLs; large videos may not sync and are best kept local in the extension package.
- Place your MP4 files into assets/videos and name them default1.mp4, default2.mp4 if you want to use packaged videos listed in config/videos.json
- To test locally: chrome://extensions -> Load unpacked -> select the ChromeUI folder -> Open a new tab.

