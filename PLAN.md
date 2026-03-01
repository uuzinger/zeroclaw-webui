# PLAN.md — zeroclaw-webui

## Goal
A lightweight, self-hosted web UI for secure file exchange between ZeroClaw and zinger.

## Status: Active
Last updated: 2026-03-01

---

## ✅ Completed
- [x] Express server with JWT auth (login/logout, remember me cookie)
- [x] Rate limiting on login endpoint (5 attempts / 15 min)
- [x] File upload via multer (50MB limit, blocked dangerous extensions: .exe .sh .bat .cmd .ps1 .msi)
- [x] Upload up to 10 files at once
- [x] File download (uploads dir + downloads dir)
- [x] File delete (by type + filename)
- [x] Access logging via morgan → logs/access.log
- [x] Login page (login.html)
- [x] Main UI (index.html + app.js + style.css)
- [x] Config file with bcrypt password hash
- [x] Git push working to uuzinger/zeroclaw-webui

## 🔄 In Progress
- [ ] Nothing currently in progress

## 📋 Next Up (prioritized)
- [ ] Review and audit the frontend (app.js) — confirm all API endpoints are wired up correctly
- [ ] Add HTTPS / TLS support (or document how to run behind nginx/caddy reverse proxy)
- [ ] Add a proper README.md with setup instructions
- [ ] Drag-and-drop upload UX improvement
- [ ] Show upload progress bar
- [ ] File rename support

## 💭 Backlog
- [ ] Multi-user support (currently single user via config)
- [ ] File expiry / auto-cleanup of old uploads
- [ ] Download count tracking
- [ ] Notifications (Telegram/Pushover) when a file is uploaded
- [ ] Dark mode UI
- [ ] Mobile-responsive polish

## 🚫 Decisions & Non-Goals
- Single-user only for now — multi-user adds complexity not currently needed
- No database — filesystem is the store, keeping it simple
- Blocked extensions list is intentionally conservative

## 🐛 Known Issues
- None currently known
