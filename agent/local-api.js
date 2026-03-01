#!/usr/bin/env node
/**
 * ZeroClaw Local Chat API — port 9999
 *
 * Accepts POST /chat with a user message, processes it through ZeroClaw,
 * and returns a response. Called by the chat-listener daemon.
 *
 * Auth: X-ZC-Key header must match ZC_LOCAL_API_KEY env var (default: zc-local-2026)
 *
 * POST /chat
 *   Body: { "message": "user text", "conversationId": "optional-id" }
 *   Response: { "reply": "ZeroClaw response text", "conversationId": "..." }
 *
 * GET /health
 *   Response: { "status": "ok" }
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = 9999;
const API_KEY = process.env.ZC_LOCAL_API_KEY || 'zc-local-2026';

// In-memory conversation store: conversationId -> message history
const conversations = new Map();
const MAX_HISTORY = 20; // keep last N turns per conversation

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

/**
 * Build a prompt from conversation history + new message.
 * Keeps it simple — system context + last N turns.
 */
function buildPrompt(history, userMessage) {
  const lines = [
    'You are ZeroClaw, a personal AI assistant for zinger.',
    'This is a web chat conversation. Be helpful, direct, and conversational.',
    'Fresh context — no memory of previous sessions.',
    ''
  ];

  for (const turn of history) {
    if (turn.role === 'user') {
      lines.push(`User: ${turn.content}`);
    } else {
      lines.push(`ZeroClaw: ${turn.content}`);
    }
  }

  lines.push(`User: ${userMessage}`);
  lines.push('ZeroClaw:');

  return lines.join('\n');
}

/**
 * Call ZeroClaw CLI to get a response.
 * Uses `zeroclaw prompt` if available, otherwise falls back to a simple echo for testing.
 */
function getZeroClawResponse(prompt) {
  try {
    // Try the zeroclaw binary
    const result = execSync(`zeroclaw prompt ${JSON.stringify(prompt)}`, {
      timeout: 60000,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    });
    return result.trim();
  } catch (e) {
    // Fallback: check if zeroclaw is in PATH with a different invocation
    try {
      const result = execSync(`echo ${JSON.stringify(prompt)} | zeroclaw`, {
        timeout: 60000,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      });
      return result.trim();
    } catch (e2) {
      throw new Error(`ZeroClaw CLI not available: ${e.message}`);
    }
  }
}

const server = http.createServer(async (req, res) => {
  // Auth check
  const key = req.headers['x-zc-key'];
  if (key !== API_KEY) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { status: 'ok', port: PORT });
  }

  // Chat endpoint
  if (req.method === 'POST' && req.url === '/chat') {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return send(res, 400, { error: 'Invalid JSON body' });
    }

    const { message, conversationId } = body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return send(res, 400, { error: 'message is required' });
    }

    const convId = conversationId || generateId();

    // Get or create conversation history
    if (!conversations.has(convId)) {
      conversations.set(convId, []);
    }
    const history = conversations.get(convId);

    // Build prompt
    const prompt = buildPrompt(history, message.trim());

    // Get response
    let reply;
    try {
      reply = getZeroClawResponse(prompt);
    } catch (e) {
      console.error('[local-api] ZeroClaw error:', e.message);
      return send(res, 503, { error: 'ZeroClaw unavailable', detail: e.message });
    }

    // Update history
    history.push({ role: 'user', content: message.trim() });
    history.push({ role: 'assistant', content: reply });

    // Trim to max history
    while (history.length > MAX_HISTORY * 2) {
      history.splice(0, 2);
    }

    return send(res, 200, { reply, conversationId: convId });
  }

  return send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-api] ZeroClaw local API listening on 127.0.0.1:${PORT}`);
  console.log(`[local-api] API key: ${API_KEY}`);
});

server.on('error', (e) => {
  console.error('[local-api] Server error:', e.message);
  process.exit(1);
});
