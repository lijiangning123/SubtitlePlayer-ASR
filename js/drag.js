// ==================== 拖拽功能模块 ====================
window.DP = window.DP || {};

// ==================== 可拖拽分隔条 ====================
DP.initResizeHandle = function initResizeHandle() {
  const resizeHandle = DP.resizeHandle;
  const videoPanelEl = document.getElementById('videoPanel');
  let dragging = false;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    resizeHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const mainRect = document.querySelector('.main').getBoundingClientRect();
    const handleWidth = resizeHandle.getBoundingClientRect().width;
    const ratio = (e.clientX - mainRect.left) / mainRect.width;
    // 限制在 30% ~ 85% 之间
    const clampedRatio = Math.max(0.30, Math.min(0.85, ratio));
    const videoPct = clampedRatio * 100;
    videoPanelEl.style.flex = `0 0 ${videoPct}%`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizeHandle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
};

// ==================== 笔记分隔条拖拽 ====================
DP.initNotesResizeHandle = function initNotesResizeHandle() {
  const handle = DP.notesResizeHandle;
  const transcriptList = document.getElementById('transcriptList');
  const notesContainer = DP.notesContainer;
  let dragging = false;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    handle.classList.add('active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const panelRect = DP.transcriptPanel.getBoundingClientRect();
    const ratio = (e.clientY - panelRect.top) / panelRect.height;
    const clamped = Math.max(0.15, Math.min(0.85, ratio));
    transcriptList.style.flex = '0 0 ' + (clamped * 100) + '%';
    notesContainer.style.flex = '0 0 ' + ((1 - clamped) * 100) + '%';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
};

// ==================== CC 区域拖拽（下方 ↔ 视频叠加，叠加后自由定位） ====================
DP.ccOverlayTopPct = null;  // 叠加模式下的 top 百分比（持久化用）

DP.initCCDrag = function initCCDrag() {
  const ccHandle = DP.ccHandle;
  const ccArea = DP.ccArea;
  const playerContainer = DP.playerContainer;
  const showToast = DP.showToast;

  let dragging = false;
  let startY = 0;
  let origTop = 0;

  ccHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    DP._ccDragActive = true;
    startY = e.clientY;

    if (ccArea.classList.contains('overlay')) {
      origTop = ccArea.offsetTop;
    }

    ccArea.style.transition = 'none';
    ccArea.style.zIndex = '50';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;

    if (ccArea.classList.contains('overlay')) {
      const playerRect = playerContainer.getBoundingClientRect();
      const ccHeight = ccArea.getBoundingClientRect().height;
      const maxTop = playerRect.height - ccHeight;
      const newTop = Math.max(0, Math.min(maxTop, origTop + dy));
      ccArea.style.top = newTop + 'px';
      ccArea.style.bottom = 'auto';
    } else {
      ccArea.style.transform = `translateY(${dy}px)`;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    ccArea.style.transition = '';
    ccArea.style.zIndex = '';
    // 阻止本次拖拽触发的 click 进入全屏
    DP._ccDragJustEnded = true;
    setTimeout(() => { DP._ccDragJustEnded = false; }, 0);

    const playerRect = playerContainer.getBoundingClientRect();
    const isOverVideo =
      playerContainer.style.display !== 'none' &&
      e.clientX >= playerRect.left &&
      e.clientX <= playerRect.right &&
      e.clientY >= playerRect.top &&
      e.clientY <= playerRect.bottom;

    if (isOverVideo) {
      if (!ccArea.classList.contains('overlay')) {
        // 从下方进入叠加模式 → 默认贴视频底端
        ccArea.style.transform = '';
        ccArea.style.top = '';
        ccArea.style.bottom = '';
        playerContainer.appendChild(ccArea);
        ccArea.classList.add('overlay');
        DP.ccOverlayTopPct = null;
        try { localStorage.setItem(DP.sessionKey('cc_overlay'), '1'); } catch (e) {}
        showToast('📌 CC 已贴到视频底端（可拖拽移动）');
      } else {
        // 拖拽结束 → 存百分比
        const ccHeight = ccArea.getBoundingClientRect().height;
        const maxTop = playerRect.height - ccHeight;
        if (maxTop > 0) {
          DP.ccOverlayTopPct = (parseFloat(ccArea.style.top) / playerRect.height) * 100;
          try { localStorage.setItem(DP.sessionKey('cc_overlay_pct'), DP.ccOverlayTopPct); } catch (e) {}
        }
      }
    } else {
      if (ccArea.classList.contains('overlay')) {
        const videoPanelEl = document.getElementById('videoPanel');
        videoPanelEl.appendChild(ccArea);
        ccArea.classList.remove('overlay');
        ccArea.style.top = '';
        ccArea.style.bottom = '';
        DP.ccOverlayTopPct = null;
        try {
          localStorage.removeItem(DP.sessionKey('cc_overlay'));
          localStorage.removeItem(DP.sessionKey('cc_overlay_pct'));
        } catch (e) {}
        showToast('📌 CC 已移回视频下方');
      } else {
        ccArea.style.transform = '';
      }
    }
  });
};
