# zeroclaw-webui

A personal web UI for file exchange and real-time chat between ZeroClaw and zinger.

## Features

- 🔐 JWT auth with rate limiting (5 attempts / 15 min)
- 📁 File upload (50MB limit, dangerous extensions blocked)
- 📥 File download from `uploads/` and `downloads/` directories
- 🗑️ File delete
- 💬 Real-time chat via WebSocket (ZeroClaw ↔ zinger)
- 🗂️ Multi-conversation support with sidebar (create, rename, delete conversations)
- 📜 Chat history (persisted, with migration from legacy single-conversation format)
- 🖊️ Markdown rendering in chat (ZeroClaw replies rendered via `marked.js`)
- 🤖 Agent listener — bridges the webui to the ZeroClaw gateway in real time
- 📋 Access logging

---

## Requirements

- Node.js 18+
- npm

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/uuzinger/zeroclaw-webui.git
cd zeroclaw-webui
npm install
```

### 2. Configure `config.js`

Edit `config.js` in the project root:

```js
module.exports = {
  PORT: 3000,                         // Port to listen on
  ZC_USERNAME: 'zinger',              // Login username
  ZC_PASSWORD_HASH: '<bcrypt hash>', // bcrypt hash of your password
  JWT_SECRET: '<long random string>', // Long random string for JWT signing
  AGENT_API_KEY: '<random key>'       // Secret key for ZeroClaw agent API calls
};
```

#### Generate a password hash

```bash
node -e "const b = require('bcryptjs'); b.hash('yourpassword', 12).then(console.log)"
```

#### Generate a JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

#### Generate an agent API key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run

```bash
node server.js
```

The server starts on `http://localhost:3000` (or whatever `PORT` is set to).

---

## Agent Listener

`agent/listener.js` is a long-running process that connects to the ZeroClaw gateway and bridges messages to/from the webui chat. It must be running for the chat to work end-to-end.

### Run manually (dev/testing)

```bash
node agent/listener.js
```

### Run as a systemd service (production)

A service file is included at `zeroclaw-webui-listener.service`. Install it:

```bash
sudo cp zeroclaw-webui-listener.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zeroclaw-webui-listener
sudo systemctl start zeroclaw-webui-listener
```

Check status:

```bash
sudo systemctl status zeroclaw-webui-listener
journalctl -u zeroclaw-webui-listener -f
```

> The service is configured to restart automatically on failure (`Restart=on-failure`).
> It expects the server to be running at the path in `WorkingDirectory` — adjust if your install path differs.

---

## Directory Structure

```
zeroclaw-webui/
├── server.js                          # Express + WebSocket server
├── config.js                          # Configuration (not committed with secrets)
├── agent/
│   └── listener.js                    # ZeroClaw gateway bridge (run as systemd service)
├── zeroclaw-webui-listener.service    # systemd unit file for the listener
├── public/
│   ├── index.html                     # Main UI (files + chat tabs)
│   ├── login.html                     # Login page
│   ├── app.js                         # Frontend JS (multi-conversation, markdown rendering)
│   └── style.css                      # Styles (two-column sidebar layout)
├── uploads/                           # Files uploaded by zinger (served to ZeroClaw)
├── downloads/                         # Files placed here by ZeroClaw (served to zinger)
├── logs/
│   └── access.log                     # HTTP access log
└── chat_history.json                  # Legacy single-conversation history (auto-migrated)
```

---

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Login with `{ username, password, rememberMe }` |
| `POST` | `/api/logout` | Clear auth cookie |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List all files in uploads/ and downloads/ |
| `POST` | `/api/upload` | Upload a file (multipart/form-data, field: `file`) |
| `GET` | `/api/download/:filename` | Download from downloads/ |
| `GET` | `/api/uploads/:filename` | Download from uploads/ |
| `DELETE` | `/api/files/:type/:filename` | Delete a file (`type`: `uploads` or `downloads`) |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conversations` | List all conversations |
| `POST` | `/api/conversations` | Create a new conversation |
| `PATCH` | `/api/conversations/:id` | Rename a conversation |
| `DELETE` | `/api/conversations/:id` | Delete a conversation |
| `GET` | `/api/conversations/:id/messages` | Get messages for a conversation |

### Chat (WebSocket)

Connect to `ws://localhost:3000` with a short-lived token:

```js
// 1. Get a WS token (requires auth cookie)
const res = await fetch('/api/chat/wstoken');
const { token } = await res.json();

// 2. Connect
const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

// 3. Send a message
ws.send(JSON.stringify({ content: 'Hello!' }));

// 4. Receive messages
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // { id, sender, content, timestamp }
};
```

### Chat (ZeroClaw Agent REST API)

These endpoints use `X-Agent-Key` header authentication (the `AGENT_API_KEY` from config).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/send` | Send a message as ZeroClaw |
| `GET` | `/api/chat/history` | Get recent chat history |

**Send a message:**
```bash
curl -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: <your-agent-api-key>" \
  -d '{"text": "Hello from ZeroClaw!"}'
```

**Get history:**
```bash
curl http://localhost:3000/api/chat/history \
  -H "X-Agent-Key: <your-agent-api-key>"
```

---

## Reverse Proxy (Production)

For HTTPS, put nginx or Caddy in front. Example nginx config:

```nginx
server {
    listen 443 ssl;
    server_name webui.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/your.crt;
    ssl_certificate_key /etc/ssl/private/your.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> ⚠️ The `Upgrade` and `Connection` headers are required for WebSocket support.

---

## ZeroClaw Agent Integration

ZeroClaw can send chat messages and read history via the REST API using the `AGENT_API_KEY`.
See the [API Reference](#chat-zeroclaw-agent-rest-api) above.

To integrate with a cron job or Telegram relay, use `http_request` with:
- URL: `http://localhost:3000/api/chat/send`
- Header: `X-Agent-Key: <key>`
- Body: `{ "text": "your message" }`
