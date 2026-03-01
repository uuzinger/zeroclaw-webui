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

### 3. Agent Listener — `agent/listener.js` ✅ DONE
- Connects to webui WebSocket using agent key as token
- Listens for `{type:'message', convoId, message}` broadcasts
- Forwards user messages to ZeroClaw gateway on port 42617
- Posts replies back via `/api/chat/send` with `x-agent-key` auth
- Deduplicates by message ID, auto-reconnects
- **Run:** `ZC_AGENT_KEY=<key> node agent/listener.js`

---

## Prerequisites (Manual — zinger to do)

- [x] Set `require_pairing = false` in `config.toml` — DONE

---

## Future Ideas (Backlog)

- HTTPS / reverse proxy setup (nginx or Caddy)
- Mobile-friendly UI improvements
- File preview in browser (images, text, PDFs)
- ZeroClaw pushes proactive messages (alerts, cron results) to webui chat
- Markdown rendering in chat messages
- `pm2` process management for server + listener
