const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const cfg = require('./config');
const PORT = cfg.PORT || 3000;

const JWT_SECRET = cfg.JWT_SECRET;
const USERNAME = cfg.ZC_USERNAME;
const PASSWORD_HASH = cfg.ZC_PASSWORD_HASH;

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DOWNLOADS_DIR = path.resolve(__dirname, '../../downloads');
const LOGS_DIR = path.resolve(__dirname, 'logs');

// Ensure dirs exist
[UPLOADS_DIR, DOWNLOADS_DIR, LOGS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// --- Logging ---
const accessLog = fs.createWriteStream(path.join(LOGS_DIR, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLog }));

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Rate limiting on login ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.zc_token;
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('zc_token');
    res.redirect('/login');
  }
}

// --- Multer setup ---
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const blocked = ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.msi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) return cb(new Error(`File type ${ext} not allowed`));
    cb(null, true);
  }
});

// --- Routes ---

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', loginLimiter, async (req, res) => {
  const { username, password, remember } = req.body;
  if (!PASSWORD_HASH) {
    return res.status(500).send('Server not configured: PASSWORD_HASH not set');
  }
  const validUser = username === USERNAME;
  const validPass = bcrypt.compareSync(password, PASSWORD_HASH);
  if (!validUser || !validPass) {
    return res.redirect('/login?error=1');
  }
  const expiresIn = remember ? '30d' : '1d';
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn });
  const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  res.cookie('zc_token', token, { httpOnly: true, sameSite: 'lax', maxAge });
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  res.clearCookie('zc_token');
  res.redirect('/login');
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/files', requireAuth, (req, res) => {
  const getFiles = (dir, type) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, size: stat.size, modified: stat.mtime, type };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
  };
  res.json({
    uploads: getFiles(UPLOADS_DIR, 'upload'),
    downloads: getFiles(DOWNLOADS_DIR, 'download')
  });
});

app.post('/api/upload', requireAuth, upload.array('files', 10), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  res.json({ success: true, files: req.files.map(f => ({ name: f.filename, size: f.size })) });
});

app.get('/api/download/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(DOWNLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  res.download(filepath);
});

app.get('/api/uploads/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  res.download(filepath);
});

app.delete('/api/files/:type/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const dir = req.params.type === 'upload' ? UPLOADS_DIR : DOWNLOADS_DIR;
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  fs.unlinkSync(filepath);
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`ZeroClaw WebUI running on http://localhost:${PORT}`);
});
