// ============================================================
// Tab switching
// ============================================================
const tabFiles = document.getElementById('tabFiles');
const tabChat  = document.getElementById('tabChat');
let unreadCount = 0;
let chatActive = false;

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    tabFiles.hidden = tab !== 'files';
    tabChat.hidden  = tab !== 'chat';
    if (tab === 'chat') {
      chatActive = true;
      unreadCount = 0;
      updateUnreadBadge();
      scrollChatToBottom();
      connectChat();
    } else {
      chatActive = false;
    }
  });
});

function updateUnreadBadge() {
  const badge = document.getElementById('unreadBadge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

// ============================================================
// Toast notifications
// ============================================================
function toast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ============================================================
// File utilities
// ============================================================
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

// ============================================================
// File list
// ============================================================
async function loadFiles() {
  try {
    const res = await fetch('/api/files');
    const data = await res.json();
    renderList('downloadsList', data.downloads, 'download');
    renderList('uploadsList', data.uploads, 'upload');
  } catch (e) {
    console.error('Failed to load files', e);
  }
}

function renderList(containerId, files, type) {
  const el = document.getElementById(containerId);
  if (!files || files.length === 0) {
    el.innerHTML = '<div class="empty">No files yet</div>';
    return;
  }
  el.innerHTML = files.map(f => `
    <div class="file-item" id="file-${type}-${encodeURIComponent(f.name)}">
      <div class="file-info">
        <div class="file-name" title="${f.name}">${f.name}</div>
        <div class="file-meta">${formatSize(f.size)} &middot; ${formatDate(f.modified)}</div>
      </div>
      <div class="file-actions">
        <button class="btn btn-download" onclick="downloadFile('${type}', '${encodeURIComponent(f.name)}')">Download</button>
        <button class="btn btn-delete" onclick="deleteFile('${type}', '${encodeURIComponent(f.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function downloadFile(type, filename) {
  const endpoint = type === 'download'
    ? `/api/download/${filename}`
    : `/api/uploads/${filename}`;
  window.location.href = endpoint;
}

async function deleteFile(type, filename) {
  if (!confirm(`Delete ${decodeURIComponent(filename)}?`)) return;
  try {
    const res = await fetch(`/api/files/${type}/${filename}`, { method: 'DELETE' });
    if (res.ok) {
      toast('File deleted');
      loadFiles();
    } else {
      toast('Delete failed', 'error');
    }
  } catch (e) {
    toast('Delete failed', 'error');
  }
}

async function uploadFiles(files) {
  if (!files.length) return;

  const progress = document.getElementById('uploadProgress');
  const fill     = document.getElementById('progressFill');
  const text     = document.getElementById('progressText');
  const inner    = document.querySelector('.upload-inner');

  inner.hidden    = true;
  progress.hidden = false;

  const formData = new FormData();
  Array.from(files).forEach(f => formData.append('files', f));

  try {
    let pct = 0;
    const interval = setInterval(() => {
      pct = Math.min(pct + 10, 85);
      fill.style.width = pct + '%';
    }, 200);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    clearInterval(interval);
    fill.style.width = '100%';

    if (res.ok) {
      const data = await res.json();
      toast(`Uploaded ${data.files.length} file(s) ✓`);
      loadFiles();
    } else {
      const err = await res.json();
      toast(err.error || 'Upload failed', 'error');
    }
  } catch (e) {
    toast('Upload failed', 'error');
  } finally {
    setTimeout(() => {
      inner.hidden    = false;
      progress.hidden = true;
      fill.style.width = '0%';
      text.textContent = 'Uploading...';
    }, 800);
  }
}

// Drag and drop
const dropzone  = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

dropzone.addEventListener('click', (e) => {
  if (e.target.tagName !== 'LABEL') fileInput.click();
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  uploadFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

// Auto-refresh files every 10 seconds
loadFiles();
setInterval(loadFiles, 10000);

// ============================================================
// Chat — WebSocket
// ============================================================
let ws = null;
let wsConnected = false;
let wsReconnectTimer = null;

// Fetch a short-lived WebSocket token from the server
// (avoids reading httpOnly cookie from JS, which is blocked by design)
async function getWsToken() {
  const res = await fetch('/api/chat/wstoken');
  if (!res.ok) return null;
  const data = await res.json();
  return data.token;
}

async function connectChat() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const wsToken = await getWsToken();
  if (!wsToken) {
    console.warn('Could not get WebSocket auth token');
    return;
  }

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url   = `${proto}://${location.host}/?token=${encodeURIComponent(wsToken)}`;

  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    wsConnected = true;
    console.log('Chat connected');
  });

  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        renderChatHistory(data.messages);
      } else if (data.type === 'message') {
        appendChatMessage(data.message);
        if (!chatActive) {
          unreadCount++;
          updateUnreadBadge();
        }
      }
    } catch (e) {
      console.error('WS parse error', e);
    }
  });

  ws.addEventListener('close', () => {
    wsConnected = false;
    // Reconnect after 3 seconds if chat tab is active
    wsReconnectTimer = setTimeout(() => {
      if (chatActive) connectChat();
    }, 3000);
  });

  ws.addEventListener('error', () => {
    ws.close();
  });
}

function scrollChatToBottom() {
  const el = document.getElementById('chatMessages');
  el.scrollTop = el.scrollHeight;
}

function renderChatHistory(messages) {
  const el = document.getElementById('chatMessages');
  if (!messages || messages.length === 0) {
    el.innerHTML = '<div class="chat-empty">No messages yet. Say hello! 👋</div>';
    return;
  }
  el.innerHTML = messages.map(m => buildBubble(m)).join('');
  scrollChatToBottom();
}

function appendChatMessage(msg) {
  const el = document.getElementById('chatMessages');
  // Remove empty state
  const empty = el.querySelector('.chat-empty');
  if (empty) empty.remove();

  el.insertAdjacentHTML('beforeend', buildBubble(msg));
  scrollChatToBottom();
}

function buildBubble(msg) {
  const isAgent  = msg.sender === 'ZeroClaw';
  const cls      = isAgent ? 'from-agent' : 'from-user';
  const time     = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const text     = escapeHtml(msg.text);
  return `
    <div class="chat-bubble ${cls}">
      <div class="chat-sender">${escapeHtml(msg.sender)}</div>
      <div>${text}</div>
      <div class="chat-meta">${time}</div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Send message
const chatInput = document.getElementById('chatInput');
const chatSend  = document.getElementById('chatSend');

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast('Not connected — reconnecting...', 'error');
    connectChat();
    return;
  }
  ws.send(JSON.stringify({ type: 'message', text }));
  chatInput.value = '';
  chatInput.style.height = 'auto';
}

chatSend.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});
