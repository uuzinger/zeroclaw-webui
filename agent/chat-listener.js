#!/usr/bin/env node
/**
 * ZeroClaw Chat Listener Daemon
 * Connects to the webui WebSocket, watches for user messages,
 * forwards them to ZeroClaw's API, and posts replies back to chat.
 *
 * Usage: ZC_AGENT_KEY=zc-agent-2026 node agent/chat-listener.js
 */

'use strict';

const WebSocket = require('ws');
const http = require('http');
const https = require('https');

// --- Config ---
const WEBUI_BASE = process.env.WEBUI_BASE || 'http://localhost:3000';
const AGENT_KEY  = process.env.ZC_AGENT_KEY || 'zc-agent-2026';
const ZC_API_URL = process.env.ZC_API_URL || 'http://localhost:9999'; // ZeroClaw local API

const WS_BASE = WEBUI_BASE.replace(/^http/, 'ws');

// How long to wait before reconnecting after disconnect (ms)
const RECONNECT_DELAY = 5000;
// Track messages we've already replied to (avoid double-replies on reconnect)
const replied = new Set();

// --- HTTP helper ---
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// --- Get a WS token via agent API key ---
async function getWsToken() {
  // Use the agent key to get a wstoken via a dedicated endpoint
  // We'll add this endpoint to server.js — for now, use the agent key directly
  // The WS server accepts the agent key as a token too (we'll patch server.js)
  return AGENT_KEY;
}

// --- Send a reply to the webui chat ---
async function sendReply(text) {
  try {
    const res = await httpPost(
      `${WEBUI_BASE}/api/chat/send`,
      { text },
      { 'x-agent-key': AGENT_KEY }
    );
    if (res.status !== 200) {
      console.error(`[chat-listener] Failed to send reply: ${res.status}`, res.body);
    }
  } catch (err) {
    console.error('[chat-listener] Error sending reply:', err.message);
  }
}

// --- Forward message to ZeroClaw and get a response ---
async function askZeroClaw(text) {
  try {
    // ZeroClaw exposes a local chat endpoint
    const res = await httpPost(
      `${ZC_API_URL}/chat`,
      { message: text, channel: 'webui' }
    );
    if (res.status === 200 && res.body && res.body.reply) {
      return res.body.reply;
    }
    console.error('[chat-listener] Unexpected ZC response:', res.status, res.body);
    return null;
  } catch (err) {
    console.error('[chat-listener] Error reaching ZeroClaw API:', err.message);
    return null;
  }
}

// --- Process an incoming message ---
async function handleMessage(msg) {
  // Only respond to user messages (not our own replies)
  if (msg.sender === 'ZeroClaw') return;
  // Don't double-reply
  if (replied.has(msg.id)) return;
  replied.add(msg.id);

  console.log(`[chat-listener] User says: ${msg.text}`);

  const reply = await askZeroClaw(msg.text);
  if (reply) {
    await sendReply(reply);
    console.log(`[chat-listener] Replied: ${reply.slice(0, 80)}...`);
  } else {
    // Fallback: acknowledge we got it but couldn't process
    await sendReply('⚠️ ZeroClaw is thinking... (API unreachable, try again in a moment)');
  }
}

// --- Connect to WebSocket ---
function connect() {
  const token = AGENT_KEY; // server will be patched to accept agent key as WS token
  const wsUrl = `${WS_BASE}/?token=${encodeURIComponent(token)}`;

  console.log(`[chat-listener] Connecting to ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('[chat-listener] Connected to webui WebSocket ✅');
  });

  ws.on('message', (data) => {
    let parsed;
    try { parsed = JSON.parse(data); } catch { return; }

    if (parsed.type === 'history') {
      // On connect, mark all existing messages as already seen
      // (only reply to NEW messages going forward)
      for (const msg of parsed.messages) {
        replied.add(msg.id);
      }
      console.log(`[chat-listener] Loaded ${parsed.messages.length} history messages (marked as seen)`);
    } else if (parsed.type === 'message') {
      handleMessage(parsed.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[chat-listener] Disconnected (${code}: ${reason}). Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY);
  });

  ws.on('error', (err) => {
    console.error('[chat-listener] WebSocket error:', err.message);
    // close handler will trigger reconnect
  });
}

// --- Start ---
console.log('[chat-listener] ZeroClaw Chat Listener starting...');
console.log(`[chat-listener] Webui: ${WEBUI_BASE}`);
console.log(`[chat-listener] ZeroClaw API: ${ZC_API_URL}`);
connect();
