// conversations.js — Multi-conversation storage layer
const fs = require('fs');
const path = require('path');

const CONVOS_DIR = path.resolve(__dirname, 'conversations');
if (!fs.existsSync(CONVOS_DIR)) fs.mkdirSync(CONVOS_DIR, { recursive: true });

const META_FILE = path.join(CONVOS_DIR, '_meta.json');

function loadMeta() {
  if (!fs.existsSync(META_FILE)) return { conversations: [] };
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf8')); }
  catch { return { conversations: [] }; }
}

function saveMeta(meta) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

function convoFile(id) {
  return path.join(CONVOS_DIR, `${id}.json`);
}

// List all conversations (sorted newest first)
function listConversations() {
  const meta = loadMeta();
  return meta.conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// Create a new conversation
function createConversation(title) {
  const id = `conv_${Date.now()}`;
  const now = new Date().toISOString();
  const convo = { id, title: title || 'New Chat', createdAt: now, updatedAt: now };

  const meta = loadMeta();
  meta.conversations.push(convo);
  saveMeta(meta);

  fs.writeFileSync(convoFile(id), JSON.stringify([], null, 2));
  return convo;
}

// Get or create the default conversation
function getOrCreateDefault() {
  const meta = loadMeta();
  if (meta.conversations.length > 0) {
    const sorted = meta.conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return sorted[0];
  }
  return createConversation('General');
}

// Rename a conversation
function renameConversation(id, title) {
  const meta = loadMeta();
  const convo = meta.conversations.find(c => c.id === id);
  if (!convo) return null;
  convo.title = title;
  convo.updatedAt = new Date().toISOString();
  saveMeta(meta);
  return convo;
}

// Delete a conversation
function deleteConversation(id) {
  const meta = loadMeta();
  const idx = meta.conversations.findIndex(c => c.id === id);
  if (idx === -1) return false;
  meta.conversations.splice(idx, 1);
  saveMeta(meta);
  const f = convoFile(id);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return true;
}

// Load messages for a conversation
function loadMessages(id, limit = 100) {
  const f = convoFile(id);
  if (!fs.existsSync(f)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(f, 'utf8'));
    return all.slice(-limit);
  } catch { return []; }
}

// Save a message to a conversation
function saveMessage(convoId, msg) {
  const meta = loadMeta();
  const convo = meta.conversations.find(c => c.id === convoId);
  if (!convo) return null;

  const f = convoFile(convoId);
  const messages = fs.existsSync(f)
    ? JSON.parse(fs.readFileSync(f, 'utf8'))
    : [];

  messages.push(msg);
  const trimmed = messages.slice(-500);
  fs.writeFileSync(f, JSON.stringify(trimmed, null, 2));

  // Update conversation metadata
  convo.updatedAt = msg.timestamp;
  convo.lastMessage = msg.text.slice(0, 80);
  saveMeta(meta);

  return msg;
}

// Migrate old chat_history.json into a default conversation (one-time)
function migrateOldHistory(oldFile) {
  if (!fs.existsSync(oldFile)) return;
  const migrated = path.join(CONVOS_DIR, '_migrated');
  if (fs.existsSync(migrated)) return;

  try {
    const old = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
    if (old.length === 0) { fs.writeFileSync(migrated, '1'); return; }

    const convo = createConversation('General');
    const f = convoFile(convo.id);
    fs.writeFileSync(f, JSON.stringify(old, null, 2));

    // Update meta with last message info
    const meta = loadMeta();
    const c = meta.conversations.find(x => x.id === convo.id);
    if (c && old.length > 0) {
      const last = old[old.length - 1];
      c.updatedAt = last.timestamp;
      c.lastMessage = last.text.slice(0, 80);
      saveMeta(meta);
    }

    fs.writeFileSync(migrated, '1');
    console.log(`Migrated ${old.length} messages from chat_history.json`);
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

module.exports = {
  listConversations,
  createConversation,
  getOrCreateDefault,
  renameConversation,
  deleteConversation,
  loadMessages,
  saveMessage,
  migrateOldHistory,
};
