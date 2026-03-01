// Toast notifications
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

// Format file size
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format date
function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

// Load file lists
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

// Download file
function downloadFile(type, filename) {
  const endpoint = type === 'download'
    ? `/api/download/${filename}`
    : `/api/uploads/${filename}`;
  window.location.href = endpoint;
}

// Delete file
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

// Upload files
async function uploadFiles(files) {
  if (!files.length) return;

  const progress = document.getElementById('uploadProgress');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  const inner = document.querySelector('.upload-inner');

  inner.hidden = true;
  progress.hidden = false;

  const formData = new FormData();
  Array.from(files).forEach(f => formData.append('files', f));

  try {
    // Fake progress since we can't track XHR progress with fetch easily
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
      inner.hidden = false;
      progress.hidden = true;
      fill.style.width = '0%';
      text.textContent = 'Uploading...';
    }, 800);
  }
}

// Drag and drop
const dropzone = document.getElementById('dropzone');
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

// Auto-refresh every 10 seconds
loadFiles();
setInterval(loadFiles, 10000);
