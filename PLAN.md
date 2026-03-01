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

---

## What's Next

### 1. Frontend — `public/app.js` (multi-conversation)
Rewrite app.js to support:
- Sidebar with conversation list (load on login)
- Active conversation switching (click to load messages)
- New conversation button
- Rename conversation (inline prompt)
- Delete conversation (confirm dialog)
- Per-conversation WebSocket message routing (send `convoId` with messages)
- Unread badge per conversation
- Messages render in active conversation panel only

### 2. Frontend — `public/style.css` (sidebar layout)
Add styles for:
- Two-column layout: sidebar (260px) + main chat area
- Conversation list items with hover/active states
- Rename/delete action buttons per conversation
- Mobile responsive (sidebar collapses)

### 3. Agent Listener — `agent/listener.js`
Persistent Node.js process that:
- Polls `/api/chat/history` (active conversation) every 2-3 seconds
- Tracks `lastSeenId` to detect new messages from zinger
- POSTs new messages to ZeroClaw HTTP gateway (`http://localhost:42617`)
- Pushes ZeroClaw's response back via `POST /api/chat/send`
- Restart strategy: run via `pm2` or shell loop

---

## Prerequisites (Manual — zinger to do)

- [ ] Set `require_pairing = false` in `config.toml` to allow unauthenticated local connections to gateway on port 42617

---

## Future Ideas (Backlog)

- HTTPS / reverse proxy setup (nginx or Caddy)
- Mobile-friendly UI improvements
- File preview in browser (images, text, PDFs)
- ZeroClaw pushes proactive messages (alerts, cron results) to webui chat
- Markdown rendering in chat messages
- `pm2` process management for server + listener
