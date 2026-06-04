// Initialize Lucide Icons
lucide.createIcons();

// State Variables
let currentMediaData = null;
let currentPlaylistOffset = 0;
let currentPlaylistItems = [];
let activeQueueItems = [];
let pendingUsername = '';

// DOM Elements
const downloadForm = document.getElementById('download-form');
const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const toggleCookiesBtn = document.getElementById('toggle-cookies');
const cookiesWrapper = document.getElementById('cookies-wrapper');
const cookiesInput = document.getElementById('cookies-input');
const platformShortcuts = document.querySelectorAll('.platform-tag');

const loadingState = document.getElementById('loading-state');
const loadingMessage = document.getElementById('loading-message');

const errorCard = document.getElementById('error-card');
const errorMessage = document.getElementById('error-message');
const closeErrorBtn = document.getElementById('close-error');

const singleResultCard = document.getElementById('single-result-card');
const singleThumb = document.getElementById('single-thumb');
const singleDuration = document.getElementById('single-duration');
const singleTitle = document.getElementById('single-title');
const singleUploader = document.getElementById('single-uploader');
const singleViews = document.getElementById('single-views');
const singleDate = document.getElementById('single-date');
const singleFormatSelect = document.getElementById('single-format-select');
const singleDownloadBtn = document.getElementById('single-download-btn');
const singleDirectBtn = document.getElementById('single-direct-btn');

const photoActions = document.getElementById('photo-actions');
const photoPreviews = document.getElementById('photo-previews');
const downloadPhotosZipBtn = document.getElementById('download-photos-zip');
const downloadActions = document.getElementById('download-actions');

const playlistResultCard = document.getElementById('playlist-result-card');
const playlistTitle = document.getElementById('playlist-title');
const playlistDesc = document.getElementById('playlist-desc');
const playlistFormatSelect = document.getElementById('playlist-format-select');
const playlistDownloadSelectedBtn = document.getElementById('playlist-download-selected');
const playlistSelectAllBtn = document.getElementById('playlist-select-all');
const playlistDeselectAllBtn = document.getElementById('playlist-deselect-all');
const playlistItemsList = document.getElementById('playlist-items-list');
const loadMoreWrapper = document.getElementById('load-more-wrapper');
const loadMoreBtn = document.getElementById('load-more-btn');

const platformModal = document.getElementById('platform-modal');
const closePlatformModalBtn = document.getElementById('close-platform-modal');
const pickerUsernameSpan = document.getElementById('picker-username');
const platformOptBtns = document.querySelectorAll('.platform-opt-btn');

const queuePanel = document.getElementById('queue-panel');
const queueProgressText = document.getElementById('queue-progress-text');
const queueItemsList = document.getElementById('queue-items-list');
const queueZipBtn = document.getElementById('queue-zip-btn');
const queueMinimizeBtn = document.getElementById('queue-minimize');
const queueCloseBtn = document.getElementById('queue-close');

const toggleAdvFormatsBtn = document.getElementById('toggle-adv-formats');
const advFormatsWrapper = document.getElementById('adv-formats-wrapper');
const advFormatsBody = document.getElementById('adv-formats-body');

// Mappings for platform selection of @usernames
const PLATFORM_MAP = {
  tiktok: (u) => `https://www.tiktok.com/${u}`,
  instagram: (u) => `https://www.instagram.com/${u.replace('@','')}/`,
  twitter: (u) => `https://twitter.com/${u.replace('@','')}`,
  youtube: (u) => `https://www.youtube.com/${u}`,
};

// Helper: Format duration (seconds -> HH:MM:SS or MM:SS)
function formatDuration(secs) {
  if (!secs && secs !== 0) return '';
  const seconds = parseInt(secs, 10);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  const formattedS = s < 10 ? `0${s}` : s;
  if (h > 0) {
    const formattedM = m < 10 ? `0${m}` : m;
    return `${h}:${formattedM}:${formattedS}`;
  }
  return `${m}:${formattedS}`;
}

// Helper: Format view count (e.g. 1.2M views)
function formatViews(views) {
  if (!views && views !== 0) return '';
  const num = parseInt(views, 10);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M views`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K views`;
  }
  return `${num} views`;
}

// Helper: Format Upload Date (e.g. YYYYMMDD -> YYYY-MM-DD)
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return '';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

// Helper: Format bytes to human readable string
function formatBytes(bytes) {
  if (!bytes) return 'Unknown size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Toggle Advanced settings (cookies)
toggleCookiesBtn.addEventListener('click', () => {
  cookiesWrapper.classList.toggle('hidden');
});

// Shortcut tags selection
platformShortcuts.forEach(tag => {
  tag.addEventListener('click', () => {
    urlInput.value = tag.getAttribute('data-url');
    urlInput.focus();
  });
});

// Close error card
closeErrorBtn.addEventListener('click', () => {
  errorCard.classList.add('hidden');
});

// Adv formats toggle
toggleAdvFormatsBtn.addEventListener('click', () => {
  advFormatsWrapper.classList.toggle('hidden');
});

// Form submission handler
downloadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputVal = urlInput.value.trim();
  errorCard.classList.add('hidden');
  
  // Normalize input and detect username shortcut (@username)
  if (inputVal.startsWith('@') && !inputVal.includes('/')) {
    pendingUsername = inputVal;
    pickerUsernameSpan.textContent = inputVal;
    platformModal.classList.remove('hidden');
    return;
  }
  
  await fetchMediaDetails(inputVal);
});

// Platform selection inside username picker modal
platformOptBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const platform = btn.getAttribute('data-platform');
    platformModal.classList.add('hidden');
    const url = PLATFORM_MAP[platform](pendingUsername);
    urlInput.value = url;
    await fetchMediaDetails(url);
  });
});

// Close username picker modal
closePlatformModalBtn.addEventListener('click', () => {
  platformModal.classList.add('hidden');
});

// Primary extraction request
async function fetchMediaDetails(url, appendPlaylist = false) {
  if (!appendPlaylist) {
    showLoading(true, "Analyzing link and extracting media details...");
    singleResultCard.classList.add('hidden');
    playlistResultCard.classList.add('hidden');
  } else {
    showLoading(true, "Loading next page of items...");
  }
  
  const cookiesText = cookiesInput.value.trim();
  
  try {
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        cookies: cookiesText,
        offset: currentPlaylistOffset
      })
    });
    
    const result = await response.json();
    showLoading(false);
    
    if (result.error) {
      showError(result.error);
      return;
    }
    
    currentMediaData = result;
    
    if (result.type === 'single') {
      displaySingleResult(result);
    } else {
      displayPlaylistResult(result, appendPlaylist);
    }
  } catch (err) {
    showLoading(false);
    showError("Could not connect to the backend API server. Make sure it is running.");
  }
}

// Manage loading spinner
function showLoading(show, message = "") {
  if (show) {
    loadingMessage.textContent = message;
    loadingState.classList.remove('hidden');
    fetchBtn.disabled = true;
  } else {
    loadingState.classList.add('hidden');
    fetchBtn.disabled = false;
  }
}

// Manage errors
function showError(msg) {
  const errorContent = errorCard.querySelector('.error-content');
  errorContent.querySelector('h4').textContent = 'Extraction Error';
  errorContent.querySelector('p').textContent = msg;
  errorCard.classList.remove('hidden');
  errorCard.style.borderLeftColor = 'var(--text-error)';
  errorCard.querySelector('.error-icon').setAttribute('data-lucide', 'alert-triangle');
  lucide.createIcons();
  window.scrollTo({ top: errorCard.offsetTop - 50, behavior: 'smooth' });
}

// Manage tips/success notifications
function showTip(title, text) {
  const errorContent = errorCard.querySelector('.error-content');
  errorContent.querySelector('h4').textContent = title;
  errorContent.querySelector('p').textContent = text;
  errorCard.classList.remove('hidden');
  errorCard.style.borderLeftColor = 'var(--accent-cyan)';
  errorCard.querySelector('.error-icon').setAttribute('data-lucide', 'info');
  lucide.createIcons();
  window.scrollTo({ top: errorCard.offsetTop - 50, behavior: 'smooth' });
}

// Display single media details
function displaySingleResult(data) {
  singleThumb.src = data.thumbnail || 'https://via.placeholder.com/250x140?text=No+Preview';
  singleDuration.textContent = data.duration ? formatDuration(data.duration) : '';
  singleTitle.textContent = data.title;
  singleUploader.innerHTML = `<i data-lucide="user"></i> ${data.uploader || 'Unknown Channel'}`;
  singleViews.innerHTML = `<i data-lucide="eye"></i> ${data.view_count ? formatViews(data.view_count) : 'N/A'}`;
  singleDate.innerHTML = `<i data-lucide="calendar"></i> ${data.upload_date ? formatDate(data.upload_date) : 'N/A'}`;
  
  lucide.createIcons();
  
  if (data.is_photo) {
    downloadActions.classList.add('hidden');
    photoActions.classList.remove('hidden');
    
    // Render photo previews
    photoPreviews.innerHTML = '';
    data.photos.forEach(photo => {
      const img = document.createElement('img');
      img.src = photo.url;
      img.className = 'gallery-preview';
      img.alt = 'Preview image';
      photoPreviews.appendChild(img);
    });
    
    downloadPhotosZipBtn.onclick = () => downloadFile(data.url, 'best', `${data.title}.zip`);
  } else {
    photoActions.classList.add('hidden');
    downloadActions.classList.remove('hidden');
    
    // Wire single buttons
    singleDownloadBtn.onclick = () => triggerSingleDownload(data.url);
    singleDirectBtn.onclick = () => getDirectLink(data.url);
  }
  
  // Advanced format tables listing
  advFormatsBody.innerHTML = '';
  if (data.formats && data.formats.length > 0) {
    data.formats.forEach(f => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><code class="format-id-badge">${f.format_id}</code></td>
        <td>${f.ext}</td>
        <td>${f.resolution}</td>
        <td>${f.vcodec || 'none'}</td>
        <td>${f.acodec || 'none'}</td>
        <td>${formatBytes(f.filesize)}</td>
        <td>
          <button class="btn-outline btn-small quick-dl-btn" data-fmt="${f.format_id}">
            <i data-lucide="download"></i> Download
          </button>
        </td>
      `;
      advFormatsBody.appendChild(row);
    });
    
    lucide.createIcons();
    
    // Advanced tables individual actions
    document.querySelectorAll('.quick-dl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fmtId = btn.getAttribute('data-fmt');
        triggerSingleDownload(data.url, fmtId);
      });
    });
  }
  
  singleResultCard.classList.remove('hidden');
  window.scrollTo({ top: singleResultCard.offsetTop - 50, behavior: 'smooth' });
}

// Platforms whose CDN URLs are IP-signed at extraction time; must use proxy-download
function isRestrictedSource(sourceUrl) {
  const lower = (sourceUrl || '').toLowerCase();
  return lower.includes('tiktok.com') ||
         lower.includes('instagram.com') ||
         lower.includes('facebook.com') ||
         lower.includes('fb.com') ||
         lower.includes('twitter.com') ||
         lower.includes('x.com');
}

// Submit a hidden form to trigger a streaming download response
function submitProxyForm(action, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.style.display = 'none';
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value || '';
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  setTimeout(() => document.body.removeChild(form), 1000);
}

// Download file trigger helper
async function downloadFile(url, format, customFilename = null) {
  const cookiesText = cookiesInput.value.trim();

  // For TikTok/Instagram/Facebook/Twitter: extract + stream in ONE Vercel call
  // so the CDN IP stays consistent (separate calls land on different instances → 403)
  if (isRestrictedSource(url)) {
    showLoading(false);
    submitProxyForm('/api/proxy-download', {
      url,
      format,
      cookies: cookiesText,
      ...(customFilename ? { filename: customFilename } : {})
    });
    return;
  }

  showLoading(true, "Preparing download link...");

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format, cookies: cookiesText })
    });
    const downloadData = await res.json();
    showLoading(false);

    if (downloadData.error) {
      showError(downloadData.error);
      return;
    }

    const directUrl = downloadData.direct_url;
    const filename = customFilename || downloadData.filename;
    const size = downloadData.filesize;

    // Large files from non-restricted CDNs: open directly (browser download)
    if (size && size > 50 * 1024 * 1024) {
      window.open(directUrl, '_blank');
    } else {
      submitProxyForm('/api/stream', {
        url: directUrl,
        filename,
        ...(downloadData.headers ? { headers: JSON.stringify(downloadData.headers) } : {})
      });
    }
  } catch (err) {
    showLoading(false);
    showError("Failed to initiate media download.");
  }
}

// Single download action handler
function triggerSingleDownload(url, forceFormat = null) {
  const format = forceFormat || singleFormatSelect.value;
  downloadFile(url, format);
}

// Fetch and open direct link
async function getDirectLink(url) {
  showLoading(true, "Generating direct url...");
  const format = singleFormatSelect.value;
  const cookiesText = cookiesInput.value.trim();
  
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format, cookies: cookiesText })
    });
    const downloadData = await res.json();
    showLoading(false);
    
    if (downloadData.error) {
      showError(downloadData.error);
      return;
    }
    
    window.open(downloadData.direct_url, '_blank');
  } catch (err) {
    showLoading(false);
    showError("Could not retrieve direct CDN link.");
  }
}

// Display playlist / channel collection listings
function displayPlaylistResult(data, append = false) {
  if (!append) {
    currentPlaylistItems = [];
    playlistItemsList.innerHTML = '';
    currentPlaylistOffset = 0;
  }
  
  playlistTitle.textContent = data.playlist_title;
  playlistDesc.textContent = `${data.count} items found · ${data.playlist_uploader || 'Collection'}`;
  
  const entries = data.items;
  currentPlaylistItems.push(...entries);
  
  entries.forEach((item, index) => {
    const absoluteIndex = currentPlaylistItems.length - entries.length + index;
    const itemEl = document.createElement('div');
    itemEl.className = 'playlist-item';
    itemEl.innerHTML = `
      <input type="checkbox" class="playlist-item-checkbox" data-index="${absoluteIndex}" checked>
      <img src="${item.thumbnail || 'https://via.placeholder.com/80x45?text=Preview'}" alt="Preview" class="playlist-item-thumb">
      <div class="playlist-item-details">
        <h4>${item.title}</h4>
        <div class="playlist-item-meta">
          <span>${item.uploader || 'Creator'}</span>
          <span>${item.duration ? formatDuration(item.duration) : ''}</span>
        </div>
      </div>
    `;
    playlistItemsList.appendChild(itemEl);
  });
  
  // Hook item checkboxes event listener to update download button badge count
  document.querySelectorAll('.playlist-item-checkbox').forEach(cb => {
    cb.addEventListener('change', updateSelectedPlaylistCount);
  });
  
  updateSelectedPlaylistCount();
  
  // Show / Hide pagination "Load More" controls
  if (entries.length === 50 && currentPlaylistItems.length < data.count) {
    loadMoreWrapper.classList.remove('hidden');
  } else {
    loadMoreWrapper.classList.add('hidden');
  }
  
  playlistResultCard.classList.remove('hidden');
  window.scrollTo({ top: playlistResultCard.offsetTop - 50, behavior: 'smooth' });
}

// Playlist select item checkboxes updates
function updateSelectedPlaylistCount() {
  const checkedBoxes = document.querySelectorAll('.playlist-item-checkbox:checked');
  playlistDownloadSelectedBtn.querySelector('span').textContent = `Download Selected (${checkedBoxes.length})`;
}

// Select All / Deselect All playlist items
playlistSelectAllBtn.addEventListener('click', () => {
  document.querySelectorAll('.playlist-item-checkbox').forEach(cb => cb.checked = true);
  updateSelectedPlaylistCount();
});

playlistDeselectAllBtn.addEventListener('click', () => {
  document.querySelectorAll('.playlist-item-checkbox').forEach(cb => cb.checked = false);
  updateSelectedPlaylistCount();
});

// Load more action handler
loadMoreBtn.addEventListener('click', async () => {
  currentPlaylistOffset += 50;
  await fetchMediaDetails(urlInput.value.trim(), true);
});

// Trigger batch downloads for selected playlist items
playlistDownloadSelectedBtn.addEventListener('click', () => {
  const selectedBoxes = document.querySelectorAll('.playlist-item-checkbox:checked');
  if (selectedBoxes.length === 0) {
    alert("Please select at least one media item to download.");
    return;
  }
  
  const selectedItems = Array.from(selectedBoxes).map(cb => {
    const idx = parseInt(cb.getAttribute('data-index'), 10);
    return currentPlaylistItems[idx];
  });
  
  const format = playlistFormatSelect.value;
  startBatchDownloads(selectedItems, format);
});

// Queue list rendering & SSE stream reader
async function startBatchDownloads(items, format) {
  activeQueueItems = items.map(item => ({
    ...item,
    status: 'queued', // queued, working, done, error
    direct_url: '',
    filename: '',
    error: ''
  }));
  
  renderQueueUI();
  queuePanel.classList.remove('hidden');
  queuePanel.classList.remove('minimized');
  
  const cookiesText = cookiesInput.value.trim();
  const batchPayload = {
    items: items.map(item => ({ url: item.url, format })),
    cookies: cookiesText
  };
  
  try {
    const response = await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchPayload)
    });
    
    if (!response.body) {
      alert("Browser does not support streaming downloads.");
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop(); // Hold onto final chunk if it is partial
      
      for (const event of events) {
        if (event.trim().startsWith("data: ")) {
          try {
            const data = JSON.parse(event.trim().substring(6));
            updateQueueItemState(data);
          } catch (e) {
            console.error("Error parsing SSE event data:", e);
          }
        }
      }
    }
  } catch (err) {
    console.error("SSE stream processing error:", err);
    activeQueueItems.forEach(item => {
      if (item.status === 'queued' || item.status === 'working') {
        item.status = 'error';
        item.error = 'Batch connection interrupted';
      }
    });
    renderQueueUI();
  }
}

// Update single item state in queue from SSE response
function updateQueueItemState(data) {
  const item = activeQueueItems.find(i => i.url === data.url);
  if (!item) return;
  
  if (data.status === 'done') {
    item.status = 'done';
    item.direct_url = data.direct_url;
    item.filename = data.filename;
    item.filesize = data.filesize;
    
    // Auto-trigger browser download for completed item
    triggerIndividualQueueDownload(item);
  } else {
    item.status = 'error';
    item.error = data.error || 'Failed to extract';
  }
  
  renderQueueUI();
}

// Trigger single completed queue item file download
function triggerIndividualQueueDownload(item) {
  const filename = item.filename || 'download.mp4';

  // For restricted platforms, re-extract + stream in one call using the original URL
  if (isRestrictedSource(item.url)) {
    submitProxyForm('/api/proxy-download', {
      url: item.url,
      format: 'best',
      filename
    });
    return;
  }

  if (item.filesize && item.filesize > 50 * 1024 * 1024) {
    window.open(item.direct_url, '_blank');
  } else {
    submitProxyForm('/api/stream', {
      url: item.direct_url,
      filename,
      ...(item.headers ? { headers: JSON.stringify(item.headers) } : {})
    });
  }
}

// Render the Queue drawer interface list rows
function renderQueueUI() {
  queueItemsList.innerHTML = '';
  
  let doneCount = 0;
  activeQueueItems.forEach(item => {
    if (item.status === 'done' || item.status === 'error') doneCount++;
    
    let badgeClass = 'queued';
    let statusText = '⏳ Queued';
    let saveBtn = '';
    
    if (item.status === 'working') {
      badgeClass = 'working';
      statusText = '⚙️ Extracting';
    } else if (item.status === 'done') {
      badgeClass = 'done';
      statusText = '✅ Done';
      saveBtn = `
        <button class="btn-primary btn-small queue-save-btn" data-url="${item.url}">
          <i data-lucide="download"></i> Save
        </button>
      `;
    } else if (item.status === 'error') {
      badgeClass = 'error';
      statusText = '❌ Error';
    }
    
    const row = document.createElement('div');
    row.className = 'queue-row';
    row.innerHTML = `
      <img src="${item.thumbnail || 'https://via.placeholder.com/50x28?text=Preview'}" class="queue-row-thumb" alt="Preview">
      <div class="queue-row-title">${item.title}</div>
      <div class="queue-status-badge ${badgeClass}">${statusText}</div>
      ${saveBtn}
    `;
    queueItemsList.appendChild(row);
  });
  
  lucide.createIcons();
  
  // Wire manual save buttons in queue
  document.querySelectorAll('.queue-save-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      const item = activeQueueItems.find(i => i.url === url);
      if (item) triggerIndividualQueueDownload(item);
    });
  });
  
  queueProgressText.textContent = `${doneCount}/${activeQueueItems.length}`;
  
  // Enable ZIP download if all items completed
  if (doneCount === activeQueueItems.length) {
    queueZipBtn.classList.remove('hidden');
    queueZipBtn.disabled = false;
    queueZipBtn.onclick = () => triggerBulkZipDownload();
  } else {
    queueZipBtn.classList.add('hidden');
    queueZipBtn.disabled = true;
  }
}

// Bulk zip downloads (simulated via triggering multiple finishes sequentially)
function triggerBulkZipDownload() {
  const completed = activeQueueItems.filter(i => i.status === 'done');
  if (completed.length === 0) return;
  
  // Trigger finished downloads consecutively
  completed.forEach((item, index) => {
    setTimeout(() => {
      triggerIndividualQueueDownload(item);
    }, index * 800); // space downloads to avoid browser spam blockers
  });
}

// Queue drawer controls
queueMinimizeBtn.addEventListener('click', () => {
  queuePanel.classList.toggle('minimized');
  const icon = queueMinimizeBtn.querySelector('i');
  if (queuePanel.classList.contains('minimized')) {
    icon.setAttribute('data-lucide', 'chevron-up');
  } else {
    icon.setAttribute('data-lucide', 'chevron-down');
  }
  lucide.createIcons();
});

queueCloseBtn.addEventListener('click', () => {
  queuePanel.classList.add('hidden');
});
