#!/usr/bin/env node
/**
 * ZeroClaw WebUI Chat Agent Helper
 * 
 * Usage:
 *   node zeroclaw-chat.js send "Hello from ZeroClaw!"
 *   node zeroclaw-chat.js history [limit]
 * 
 * Environment:
 *   ZC_WEBUI_URL   — base URL of the webui (default: http://localhost:3000)
 *   ZC_AGENT_KEY   — the AGENT_API_KEY from config.js
 */

const WEBUI_URL = process.env.ZC_WEBUI_URL || 'http://localhost:3000';
const AGENT_KEY = process.env.ZC_AGENT_KEY || '';

if (!AGENT_KEY) {
  console.error('ERROR: ZC_AGENT_KEY environment variable is required');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'x-agent-key': AGENT_KEY
};

async function sendMessage(text) {
  const res = await fetch(`${WEBUI_URL}/api/chat/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send failed (HTTP ${res.status}): ${err}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function getHistory(limit = 20) {
  const res = await fetch(`${WEBUI_URL}/api/chat/history?limit=${limit}`, {
    headers
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`History failed (HTTP ${res.status}): ${err}`);
  }
  const data = await res.json();
  // Pretty print for CLI use
  for (const msg of data.messages) {
    const ts = new Date(msg.timestamp).toLocaleTimeString();
    console.log(`[${ts}] ${msg.sender}: ${msg.text}`);
  }
  return data;
}

// --- Main CLI ---
const [,, cmd, ...args] = process.argv;

(async () => {
  try {
    if (cmd === 'send') {
      const text = args.join(' ');
      if (!text) { console.error('Usage: zeroclaw-chat.js send <message>'); process.exit(1); }
      await sendMessage(text);
    } else if (cmd === 'history') {
      const limit = parseInt(args[0]) || 20;
      await getHistory(limit);
    } else {
      console.error('Usage: zeroclaw-chat.js <send|history> [args]');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
