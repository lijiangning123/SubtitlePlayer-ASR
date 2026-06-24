window.DP = window.DP || {};

DP.formatTime = function(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

DP.formatTimeFull = function(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

// 始终返回 MM:SS（分钟可超过 60）
DP.formatTimeMMSS = function(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

DP.parseTimeToSeconds = function(timeStr) {
  timeStr = timeStr.trim();
  // 处理 SRT 的毫秒分隔符 `,` 和 VTT 的 `.`
  let ms = 0;
  timeStr = timeStr.replace(',', '.');
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const secParts = parts[2].split('.');
    ms = parseFloat('0.' + (secParts[1] || '0'));
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(secParts[0]) + ms;
  }
  return parseFloat(timeStr) || 0;
};

DP.escapeHTML = function(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

DP.highlightText = function(text, query) {
  if (!query.trim()) return DP.escapeHTML(text);
  const escaped = DP.escapeHTML(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escaped.replace(regex, '<span class="highlight">$1</span>');
};

DP.showToast = function(msg) {
  if (DP.toastsMuted) return;
  clearTimeout(DP.toastTimer);
  DP.toastEl.textContent = msg;
  DP.toastEl.classList.add('show');
  DP.toastTimer = setTimeout(() => DP.toastEl.classList.remove('show'), 2000);
};
