window.DP = window.DP || {};

// ==================== 字幕文稿面板 ====================

DP.createSubEntryDOM = function createSubEntryDOM(sub, idx) {
  const div = document.createElement('div');
  div.className = 'sub-entry';
  div.setAttribute('data-sub-idx', idx);
  div.innerHTML = `
    <span class="sub-time" data-seek="${sub.start}">${DP.formatTimeMMSS(sub.start)}</span>
    <span class="sub-text">${DP.escapeHTML(sub.text)}</span>
    <button class="sub-delete" title="删除此条">✕</button>
  `;
  const textEl = div.querySelector('.sub-text');
  const delBtn  = div.querySelector('.sub-delete');

  // 点击时间戳 → 跳转
  div.querySelector('.sub-time').addEventListener('click', (e) => {
    e.stopPropagation();
    if (DP.video.src && DP.video.duration) {
      DP.video.currentTime = sub.start;
    }
  });

  // 辅助：从 DOM 动态读取当前索引（避免闭包 stale）
  function curIdx() { return parseInt(div.getAttribute('data-sub-idx')); }

  // 点击整行
  div.addEventListener('click', (e) => {
    const i = curIdx();
    if (DP.editMode) {
      e.stopPropagation();
      if (DP.selectedSubIdx === i) {
        DP.deselectSub();
      } else {
        DP.selectSub(i);
      }
    } else if (!e.target.closest('.sub-delete') && !e.target.closest('.sub-text[contenteditable]')) {
      if (DP.video.src && DP.video.duration && DP.subtitles[i]) {
        DP.video.currentTime = DP.subtitles[i].start;
      }
    }
  });

  // 编辑模式下双击文本 → 编辑
  div.addEventListener('dblclick', (e) => {
    if (DP.editMode && e.target.closest('.sub-text')) {
      e.stopPropagation();
      DP.pushUndo();
      textEl.contentEditable = 'true';
      textEl.focus();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  // 文本编辑完成（失焦）
  textEl.addEventListener('blur', () => {
    if (textEl.contentEditable === 'true') {
      textEl.contentEditable = 'false';
      const i = curIdx();
      const sub = DP.subtitles[i];
      if (!sub) return;
      const newText = textEl.textContent.trim();
      if (newText !== sub.text) {
        sub.text = newText;
        DP.editDirty = true;
        if (DP.currentSubIdx === i) DP.updateCCOverlay(i);
      }
    }
  });

  // 删除按钮
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DP.deleteSubtitle(curIdx());
  });

  return div;
};

DP.selectSub = function selectSub(idx) {
  DP.deselectSub();
  DP.selectedSubIdx = idx;
  if (DP.subtitles[idx]?.element) {
    DP.subtitles[idx].element.classList.add('selected');
  }
};

DP.deselectSub = function deselectSub() {
  if (DP.selectedSubIdx >= 0 && DP.subtitles[DP.selectedSubIdx]?.element) {
    DP.subtitles[DP.selectedSubIdx].element.classList.remove('selected');
    // 撤销正在编辑的状态
    const textEl = DP.subtitles[DP.selectedSubIdx].element.querySelector('.sub-text');
    if (textEl) textEl.contentEditable = 'false';
  }
  DP.selectedSubIdx = -1;
};

DP.deleteSubtitle = function deleteSubtitle(idx) {
  if (idx < 0 || idx >= DP.subtitles.length) return;
  DP.pushUndo();
  const sub = DP.subtitles[idx];
  if (sub.element) sub.element.remove();
  DP.subtitles.splice(idx, 1);
  // 重新索引
  DP.subtitles.forEach((s, i) => { s.id = i; s.element?.setAttribute('data-sub-idx', i); });
  if (DP.selectedSubIdx === idx) DP.selectedSubIdx = -1;
  if (DP.currentSubIdx === idx) DP.currentSubIdx = -1;
  if (DP.currentSubIdx > idx) DP.currentSubIdx--;
  DP.editDirty = true;
  DP.updateSubCount();
  DP.rebuildTimelineMarkers();
  DP.saveSubtitlesToStorage();
};

DP.rebuildTranscript = function rebuildTranscript() {
  // 清空
  DP.transcriptList.querySelectorAll('.sub-entry').forEach(el => el.remove());
  if (DP.transcriptEmpty) DP.transcriptEmpty.style.display = DP.subtitles.length === 0 ? 'block' : 'none';

  DP.subtitles.forEach((sub, idx) => {
    const el = DP.createSubEntryDOM(sub, idx);
    DP.transcriptList.appendChild(el);
    sub.element = el;
  });

  // 重新应用搜索过滤
  DP.applySearch();
};

DP.rebuildTimelineMarkers = function rebuildTimelineMarkers() {
  // 清除旧标记
  DP.timelineBar.querySelectorAll('.sub-marker').forEach(el => el.remove());
  if (!DP.video.duration || !isFinite(DP.video.duration)) return;

  DP.subtitles.forEach(sub => {
    const marker = document.createElement('div');
    marker.className = 'sub-marker';
    marker.style.left = (sub.start / DP.video.duration) * 100 + '%';
    DP.timelineBar.appendChild(marker);
  });
};

DP.updateSubCount = function updateSubCount() {
  DP.subCount.textContent = DP.subtitles.length > 0 ? `${DP.subtitles.length} 条` : '';
};

/** 高亮当前播放的字幕 */
DP.highlightCurrentSubtitle = function highlightCurrentSubtitle(currentTime) {
  let foundIdx = -1;
  for (let i = 0; i < DP.subtitles.length; i++) {
    if (currentTime >= DP.subtitles[i].start && currentTime < DP.subtitles[i].end) {
      foundIdx = i;
      break;
    }
  }

  if (foundIdx !== DP.currentSubIdx) {
    // 移除旧高亮
    if (DP.currentSubIdx >= 0 && DP.subtitles[DP.currentSubIdx]?.element) {
      DP.subtitles[DP.currentSubIdx].element.classList.remove('active');
    }
    DP.currentSubIdx = foundIdx;
    // 添加新高亮
    if (foundIdx >= 0 && DP.subtitles[foundIdx]?.element) {
      DP.subtitles[foundIdx].element.classList.add('active');
      // 自动滚动到中间（仅滚动文稿容器，不跳页面）
      if (DP.autoScrollEnabled) {
        const el = DP.subtitles[foundIdx].element;
        const container = DP.transcriptList;
        const cTop = container.getBoundingClientRect().top;
        const eTop = el.getBoundingClientRect().top;
        const target = container.scrollTop + (eTop - cTop) - container.clientHeight / 2 + el.offsetHeight / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      }
    }
  }

  // 更新 CC 字幕
  DP.updateCCOverlay(foundIdx);
};

/** 更新 CC 字幕显示区 */
DP.updateCCOverlay = function updateCCOverlay(subIdx) {
  if (!DP.ccEnabled || subIdx < 0) {
    DP.ccText.textContent = '';
    return;
  }
  const sub = DP.subtitles[subIdx];
  DP.ccText.textContent = sub ? sub.text : '';
};

/** 搜索过滤 */
DP.applySearch = function applySearch() {
  const query = DP.searchBox.value.trim().toLowerCase();
  let visibleCount = 0;
  DP.subtitles.forEach((sub) => {
    if (!sub.element) return;
    if (!query) {
      sub.element.style.display = '';
      sub.element.classList.remove('searched');
      sub.element.querySelector('.sub-text').innerHTML = DP.escapeHTML(sub.text);
      visibleCount++;
    } else if (sub.text.toLowerCase().includes(query)) {
      sub.element.style.display = '';
      sub.element.classList.add('searched');
      sub.element.querySelector('.sub-text').innerHTML = DP.highlightText(sub.text, query);
      visibleCount++;
    } else {
      sub.element.style.display = 'none';
      sub.element.classList.remove('searched');
    }
  });
  DP.subCount.textContent = query
    ? `${visibleCount} / ${DP.subtitles.length} 条`
    : (DP.subtitles.length > 0 ? `${DP.subtitles.length} 条` : '');
};
