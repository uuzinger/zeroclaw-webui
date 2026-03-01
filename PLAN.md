# PLAN.md — zeroclaw-webui

## Project Goal
A personal web UI for file exchange and real-time chat between ZeroClaw and zinger.

## Status: Active
Last updated: 2026-03-01

---

## ✅ Completed

- [x] Express server with JWT auth (login/logout, remember me)
- [x] Rate limiting on login (5 attempts / 15 min)
- [x] File upload (multer, 50MB limit, blocked dangerous extensions)
- [x] File download from uploads/ and downloads/ dirs
- [x] File delete
- [x] Access logging (morgan → logs/access.log)
- [x] Login page + main UI (index.html, login.html, style.css, app.js)
- [x] Config file with bcrypt password hash
- [x] Fix DOWNLOADS_DIR path (was incorrectly pointing 2 levels up)
- [x] .gitignore (node_modules, logs, uploads, downloads, chat_history.json)
- [x] Frontend app.js audit — all endpoints verified, chat wired correctly
- [x] **Chat feature** — WebSocket server with JWT auth
- [x] **Chat feature** — REST API for ZeroClaw agent (POST /api/chat/send, GET /api/chat/history)
- [x] **Chat feature** — Short-lived WS token endpoint (/api/chat/wstoken)
- [x] **Chat feature** — Chat UI panel with tab switching, unread badge, auto-scroll
- [x] **Chat feature** — Message history (last 500 msgs, JSON file)
- [x] **Chat feature** — Fix: use wstoken endpoint instead of reading httpOnly cookie from JS
- [x] **Chat feature** — Fix: /api/chat/history accepts agent API key OR user cookie
- [x] **README.md** — full setup instructions, API reference, nginx config
- [x] Git push workflow verified (uuzinger/zeroclaw-webui)

---

## 🔄 In Progress

*(nothing currently)*

---

## 📋 Next Up (prioritized)

- [ ] **ZeroClaw agent integration** — wire up a helper skill/function so I can send chat messages from cron jobs or Telegram relay
- [ ] **Test the full flow end-to-end** — deploy somewhere accessible, verify chat works
- [ ] **config.js setup guide** — document required fields (ZC_USERNAME, ZC_PASSWORD_HASH, ZC_AGENT_KEY, etc.)
- [ ] **HTTPS / reverse proxy** — nginx or caddy config for production deployment

---

## 💭 Backlog

- [ ] Telegram bridge — relay chat messages between webui and Telegram
- [ ] File previews (images inline, text preview)
- [ ] Pagination for large file lists
- [ ] Dark mode toggle
- [ ] Mobile-responsive polish
- [ ] SQLite for chat history (replace JSON file for better performance)
- [ ] Read receipts / message status

---

## 🚫 Decisions / Non-Goals

- No multi-user support — this is a personal 1:1 tool (zinger ↔ ZeroClaw)
- No cloud storage — local filesystem only
- No public registration — single hardcoded user in config

---

## 🐛 Known Issues

*(none currently)*
