# ZeroClaw WebUI — Plan

## Status: In Progress

---

## What's Done

- ✅ Express server running on port 3000
- ✅ JWT auth with rate limiting
- ✅ File upload/download/delete API
- ✅ WebSocket chat (zinger ↔ ZeroClaw)
- ✅ Multi-conversation backend (`conversations.js`) with migration from legacy `chat_history.json`
- ✅ Multi-conversation API (`/api/conversations`, `/api/conversations/:id/messages`)
- ✅ Agent REST API (`/api/chat/send`, `/api/chat/history`) with `X-Agent-Key` auth
- ✅ `server.js` fully rewritten with conversation support
- ✅ `index.html` updated with sidebar HTML structure
- ✅ `agent/listener.js` — direct gateway integration (port 42617, no CLI spawning)
- ✅ **WebUI chat tested and working end-to-end** (2026-03-01)
- ✅ `public/app.js` — multi-conversation sidebar, WebSocket routing, rename/delete/new convo
- ✅ `public/style.css` — two-column sidebar layout, convo list styles, mobile responsive
- ✅ Fixed onclick quote escaping bug in `renderConvoList` (2026-03-01)

---

## What's Next

### 🔄 1. Test the full UI end-to-end
- Log in at http://zeroclaw.zinger.org:3000
- Verify sidebar loads conversations
- Test new conversation, rename, delete
- Test sending a message and receiving a reply
- Check mobile layout

### 2. Agent Listener — wire to gateway
- `agent/listener.js` is ready; needs `require_pairing = false` in config.toml ← **zinger to do**
- Once unblocked: start listener and test full round-trip (webui → gateway → ZeroClaw → webui)
- Consider adding to systemd as `zeroclaw-webui-listener.service`

### 3. Markdown rendering in chat
- Messages currently render as plain text (HTML-escaped)
- Add a lightweight markdown renderer (e.g. `marked.js` via CDN) for ZeroClaw replies
- Only render ZeroClaw messages as markdown; user messages stay plain text

---

## Prerequisites (Manual — zinger to do)

- [x] Set `require_pairing = false` in `config.toml` — DONE

---

## Future Ideas (Backlog)

- HTTPS / reverse proxy setup (nginx or Caddy)
- Mobile-friendly UI improvements
- File preview in browser (images, text, PDFs)
- ZeroClaw pushes proactive messages (alerts, cron results) to webui chat
- `pm2` process management for server + listener
- SQLite for chat history (replace JSON)
