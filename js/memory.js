window.DP = window.DP || {};

// ==================== 记忆功能（IndexedDB + localStorage） ====================

DP.IDB_NAME = 'dp-player';
DP.IDB_STORE = 'handles';

DP.savedVideoHandle = null;
DP.lastVideoHandle  = null;
DP.subFileHandle    = null;

DP.openIDB = function() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DP.IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(DP.IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

DP.saveVideoHandle = async function(handle) {
  try {
    const db = await DP.openIDB();
    const tx = db.transaction(DP.IDB_STORE, 'readwrite');
    tx.objectStore(DP.IDB_STORE).put(handle, DP.sessionKey('video'));
    // 同时存一份全局备份，跨 session 恢复用
    tx.objectStore(DP.IDB_STORE).put(handle, 'video');
    await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
    console.log('💾 视频句柄已保存');
  } catch(e) { console.warn('保存视频句柄失败:', e); }
};

// Firefox 后备：直接把 File 对象存入 IDB（Firefox 支持 File 的结构化克隆，Chrome 不行）
DP.saveVideoFile = async function(file) {
  if (window.showOpenFilePicker) return;  // Chrome 走句柄路径，不存 File
  try {
    const db = await DP.openIDB();
    const tx = db.transaction(DP.IDB_STORE, 'readwrite');
    tx.objectStore(DP.IDB_STORE).put(file, DP.sessionKey('video_file'));
    await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
    console.log('💾 视频文件已缓存（Firefox 模式）');
  } catch(e) { console.warn('缓存视频文件失败:', e); }
};

DP.loadVideoFile = async function() {
  try {
    const db = await DP.openIDB();
    const file = await new Promise(r => {
      const req = db.transaction(DP.IDB_STORE, 'readonly').objectStore(DP.IDB_STORE).get(DP.sessionKey('video_file'));
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(null);
    });
    if (file && file.name && file.size > 0) return file;
    return null;
  } catch(e) { return null; }
};

DP.saveSubHandle = async function(handle) {
  try {
    const db = await DP.openIDB();
    const tx = db.transaction(DP.IDB_STORE, 'readwrite');
    tx.objectStore(DP.IDB_STORE).put(handle, DP.sessionKey('subtitle'));
    // 同时存一份全局备份
    tx.objectStore(DP.IDB_STORE).put(handle, 'subtitle');
    await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
  } catch(e) { /* ignore */ }
};

DP.loadSubHandle = async function() {
  try {
    const db = await DP.openIDB();
    let handle = await new Promise(r => {
      const req = db.transaction(DP.IDB_STORE, 'readonly').objectStore(DP.IDB_STORE).get(DP.sessionKey('subtitle'));
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(null);
    });
    // 兼容旧版全局 key
    if (!handle) {
      handle = await new Promise(r => {
        const req = db.transaction(DP.IDB_STORE, 'readonly').objectStore(DP.IDB_STORE).get('subtitle');
        req.onsuccess = () => r(req.result);
        req.onerror = () => r(null);
      });
      if (handle) {
        const tx = db.transaction(DP.IDB_STORE, 'readwrite');
        tx.objectStore(DP.IDB_STORE).put(handle, DP.sessionKey('subtitle'));
        await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
      }
    }
    return handle || null;
  } catch(e) { return null; }
};

DP.loadStoredHandle = async function() {
  try {
    const db = await DP.openIDB();
    let handle = await new Promise(r => {
      const req = db.transaction(DP.IDB_STORE, 'readonly').objectStore(DP.IDB_STORE).get(DP.sessionKey('video'));
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(null);
    });
    // 兼容旧版全局 key
    if (!handle) {
      handle = await new Promise(r => {
        const req = db.transaction(DP.IDB_STORE, 'readonly').objectStore(DP.IDB_STORE).get('video');
        req.onsuccess = () => r(req.result);
        req.onerror = () => r(null);
      });
      if (handle) {
        const tx = db.transaction(DP.IDB_STORE, 'readwrite');
        tx.objectStore(DP.IDB_STORE).put(handle, DP.sessionKey('video'));
        await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
      }
    }
    return handle || null;
  } catch(e) { return null; }
};

DP.tryRestoreVideo = async function(handle) {
  // 仅静默查询；不调用 requestPermission（需要用户手势）
  try {
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm === 'granted') {
      const file = await handle.getFile();
      DP.loadVideo(file);
      // 补时间轴标记
      if (DP.subtitles.length > 0) {
        const onMeta = () => {
          DP.rebuildTimelineMarkers();
          DP.video.removeEventListener('loadedmetadata', onMeta);
        };
        DP.video.addEventListener('loadedmetadata', onMeta);
      }
      DP.savedVideoHandle = null;
      DP.btnRestore.style.display = 'none';
      DP.showToast('🕐 已恢复上次的视频和字幕');
      return true;
    }
  } catch(e) { /* 权限不足或句柄失效 */ }
  // 需要用户点击 → 显示按钮
  DP.savedVideoHandle = handle;
  DP.btnRestore.style.display = '';
  return false;
};

// 恢复按钮
DP.btnRestore = document.getElementById('btnRestore');
DP.btnRestore.addEventListener('click', async () => {
  if (!DP.savedVideoHandle) return;
  try {
    const perm = await DP.savedVideoHandle.requestPermission({ mode: 'read' });
    if (perm === 'granted') {
      const file = await DP.savedVideoHandle.getFile();
      DP.loadVideo(file);
      if (DP.subtitles.length > 0) {
        const onMeta = () => {
          DP.rebuildTimelineMarkers();
          DP.video.removeEventListener('loadedmetadata', onMeta);
        };
        DP.video.addEventListener('loadedmetadata', onMeta);
      }
      DP.savedVideoHandle = null;
      DP.btnRestore.style.display = 'none';
      DP.showToast('🕐 已恢复上次的视频和字幕');
    }
  } catch(e) {
    // 句柄彻底失效 → 清除
    const db = await DP.openIDB();
    const tx = db.transaction(DP.IDB_STORE, 'readwrite');
    tx.objectStore(DP.IDB_STORE).delete(DP.sessionKey('video'));
    tx.objectStore(DP.IDB_STORE).delete('video');
    DP.savedVideoHandle = null;
    DP.btnRestore.style.display = 'none';
    DP.showToast('⚠ 视频文件已失效，请重新打开');
  }
});

// ==================== 初始化：恢复上次会话 ====================
DP.restoreSession = async function() {
  // 恢复主题
  try {
    const savedTheme = localStorage.getItem('dp_theme');
    if (savedTheme && savedTheme !== 'default') {
      DP.setTheme(savedTheme);
    }
  } catch(e) {}

  // 恢复 CC 字体大小
  try {
    const savedFont = localStorage.getItem('dp_cc_font');
    if (savedFont) { DP.ccFontSize = parseFloat(savedFont); }
  } catch(e) {}
  DP.updateCCFontSize();

  // 恢复 CC 开关状态
  try {
    const ccOn = localStorage.getItem('dp_cc_enabled');
    if (ccOn === '0') {
      DP.ccEnabled = false;
      DP.ccArea.style.display = 'none';
      DP.btnToggleCC.textContent = '💬 CC 关';
      DP.btnToggleCC.style.opacity = '0.5';
    }
  } catch(e) {}

  // 恢复字幕句柄
  const subH = await DP.loadSubHandle();
  if (subH) DP.subFileHandle = subH;

  // 恢复视频：优先走 File System Access API 句柄（Chrome），否则走 File 对象（Firefox）
  const handle = await DP.loadStoredHandle();
  if (handle) {
    DP.lastVideoHandle = handle;
    const restored = await DP.tryRestoreVideo(handle);
    if (!restored) {
      console.log('🔐 视频需要点击 🕐恢复 按钮（浏览器要求用户手势）');
    }
  } else {
    // Firefox 后备：从 IDB 取出缓存的 File 对象，无需用户手势
    const file = await DP.loadVideoFile();
    if (file) {
      DP.loadVideo(file);
      if (DP.subtitles.length > 0) {
        const onMeta = () => {
          DP.rebuildTimelineMarkers();
          DP.video.removeEventListener('loadedmetadata', onMeta);
        };
        DP.video.addEventListener('loadedmetadata', onMeta);
      }
      DP.showToast('📁 已从缓存恢复视频');
      console.log('📁 已从缓存恢复视频（Firefox 模式）:', file.name);
    }
  }
};
