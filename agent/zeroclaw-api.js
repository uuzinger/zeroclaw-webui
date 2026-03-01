#!/usr/bin/env node
/**
 * ZeroClaw Local Chat API — port 9999
 * Accepts POST /chat { message } and returns { reply }
 * by spawning a ZeroClaw agent call.
 *
 * This is the bridge between the webui chat-listener and ZeroClaw.
 * Run: node zeroclaw-api.js
 */

const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 9999;
const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || '/home/zinger/.cargo/bin/zeroclaw';
const WORKSPACE = process.env.ZEROCLAW_WORKSPACE || '/home/zinger/.zeroclaw/workspace';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Call ZeroClaw CLI with a message and return the response
function callZeroClaw(message) {
  return new Promise((resolve, reject) => {
    // Check if zeroclaw binary exists
    if (!fs.existsSync(ZEROCLAW_BIN)) {
      return reject(new Error(`ZeroClaw binary not found at ${ZEROCLAW_BIN}`));
    }

    const args = ['chat', '--format', 'text', '--', message];
    const opts = {
      cwd: WORKSPACE,
      timeout: 120000, // 2 min max
      maxBuffer: 1024 * 1024 * 4 // 4MB
    };

    execFile(ZEROCLAW_BIN, args, opts, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`ZeroClaw error: ${err.message}\n${stderr}`));
      }
      resolve(stdout.trim());
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers for local access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', binary: ZEROCLAW_BIN, exists: fs.existsSync(ZEROCLAW_BIN) }));
    return;
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body);
        if (!message || typeof message !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'message is required' }));
          return;
        }

        log(`Received: ${message.substring(0, 80)}`);
        const reply = await callZeroClaw(message);
        log(`Reply: ${reply.substring(0, 80)}`);

        res.writeHead(200);
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        log(`Error: ${err.message}`);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  log(`ZeroClaw local API listening on http://127.0.0.1:${PORT}`);
  log(`Binary: ${ZEROCLAW_BIN} (exists: ${fs.existsSync(ZEROCLAW_BIN)})`);
});

server.on('error', (err) => {
  log(`Server error: ${err.message}`);
  process.exit(1);
});
