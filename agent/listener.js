#!/usr/bin/env node
/**
 * ZeroClaw WebUI Chat Listener
 *
 * Connects to the webui WebSocket, watches for user messages,
 * forwards them to the ZeroClaw gateway (POST /webhook on port 42617),
 * and posts the reply back to the webui via /api/chat/send.
 *
 * No CLI spawning. No port-9999 middleman. Direct gateway connection.
 *
 * Run: node agent/listener.js
 * Env: ZC_AGENT_KEY  — must match AGENT_API_KEY in webui config.js
 */

const WebSocket = require('ws');
const http = require('http');

const WEBUI_URL    = process.env.ZC_WEBUI_URL    || 'http://localhost:3000';
const WEBUI_WS     = process.env.ZC_WEBUI_WS     || 'ws://localhost:3000';
const GATEWAY_URL  = process.env.ZC_GATEWAY_URL  || 'http://127.0.0.1:42617';
const AGENT_KEY    = process.env.ZC_AGENT_KEY    || 'zc-agent-2026';

// Track in-flight requests to avoid duplicate processing
const inFlight = new Set();

let ws = null;
let reconnectTimer = null;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ----------------------------------------------------------------
// POST to ZeroClaw gateway /webhook
// ----------------------------------------------------------------
async function askZeroClaw(message) {
  const body = JSON.stringify({ message });

  return new Promise((resolve, reject) => {
    const url = new URL(`${GATEWAY_URL}/webhook`);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Gateway returned HTTP ${res.statusCode}: ${data}`));
        }
        try {
          const json = JSON.parse(data);
          // Gateway returns { response: "..." } or { reply: "..." } or { text: "..." }
          const text = json.response || json.reply || json.text || json.message || data;
          resolve(String(text).trim());
        } catch {
          // If not JSON, return raw text
          resolve(data.trim());
        }
      });
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Gateway request timed out after 120s'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ----------------------------------------------------------------
// POST reply back to the webui
// ----------------------------------------------------------------
async function postReply(text, convoId) {
  const body = JSON.stringify({ text, convoId });

  return new Promise((resolve, reject) => {
    const url = new URL(`${WEBUI_URL}/api/chat/send`);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-agent-key': AGENT_KEY
      }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Webui /api/chat/send returned HTTP ${res.statusCode}: ${data}`));
        }
        resolve(data);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ----------------------------------------------------------------
// Handle an incoming message from the webui WebSocket
// ----------------------------------------------------------------
async function handleMessage(msg, convoId) {
  // Only process user messages (not ZeroClaw's own replies)
  if (!msg || msg.sender === 'ZeroClaw' || msg.sender === 'agent') return;
  if (!msg.text || typeof msg.text !== 'string') return;

  // Deduplicate by message ID
  const key = msg.id ? String(msg.id) : `${msg.timestamp}:${msg.text}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  // Clean up old keys after 5 minutes
  setTimeout(() => inFlight.delete(key), 5 * 60 * 1000);

  log(`[${convoId || 'default'}] User: ${msg.text.substring(0, 100)}`);

  try {
    const reply = await askZeroClaw(msg.text);
    log(`[${convoId || 'default'}] ZeroClaw: ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`);
    await postReply(reply, convoId);
  } catch (err) {
    log(`Error: ${err.message}`);
    try {
      await postReply('⚠️ Sorry, I had trouble processing that. Please try again.', convoId);
    } catch {
      // best effort
    }
  }
}

// ----------------------------------------------------------------
// WebSocket connection to the webui
// ----------------------------------------------------------------
function connect() {
  log(`Connecting to webui WebSocket at ${WEBUI_WS}...`);

  // Use the agent key directly as the WS token (server.js accepts it)
  ws = new WebSocket(`${WEBUI_WS}/?token=${AGENT_KEY}`);

  ws.on('open', () => {
    log('Connected to webui WebSocket ✓');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  ws.on('message', (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }

    // Server broadcasts: { type: 'message', convoId, message: { sender, text, id, ... } }
    if (parsed.type === 'message' && parsed.message) {
      handleMessage(parsed.message, parsed.convoId);
      return;
    }

    // Fallback: bare message object (legacy format)
    if (parsed.sender && parsed.text) {
      handleMessage(parsed, parsed.convoId);
    }
  });

  ws.on('close', (code, reason) => {
    log(`WebSocket closed (${code}${reason ? ': ' + reason : ''}), reconnecting in 5s...`);
    ws = null;
    reconnectTimer = setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    log(`WebSocket error: ${err.message}`);
    // close handler will trigger reconnect
  });
}

// ----------------------------------------------------------------
// Startup
// ----------------------------------------------------------------
log('ZeroClaw Chat Listener starting...');
log(`  Webui:   ${WEBUI_URL}`);
log(`  Gateway: ${GATEWAY_URL}`);
log(`  Agent key configured: ${AGENT_KEY ? 'yes' : 'NO — set ZC_AGENT_KEY'}`);

connect();

process.on('SIGINT', () => {
  log('Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});
