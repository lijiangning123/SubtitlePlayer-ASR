window.DP = window.DP || {};

// ==================== 笔记 —— txt 格式的字幕 ====================

DP.notesMode   = false;
DP.notes       = [];          // [{ start: seconds, text: "..." }]
DP.notesUndo   = [];
DP.notesRedo   = [];
DP.notesDirty  = false;

DP.notesKey = function() {
  // 笔记按视频分别存储
  const video = DP.currentVideoName || '_none';
  return DP.sessionKey('notes_' + video);
};

// 切视频时重新加载
DP.reloadNotesForVideo = function() {
  DP.notes = [];
  DP.notesUndo = [];
  DP.notesRedo = [];
  DP.notesDirty = false;
  DP.loadNotesFromStorage();
  DP.renderNotes();
};

DP.pushNotesUndo = function() {
  DP.notesUndo.push(DP.notes.map(n => ({ start: n.start, text: n.text })));
  if (DP.notesUndo.length > 20) DP.notesUndo.shift();
  DP.notesRedo = [];
};

// ---- 渲染笔记列表 ----
DP.renderNotes = function() {
  DP.notesList.innerHTML = '';
  DP.notes.forEach((note, idx) => {
    const div = document.createElement('div');
    div.className = 'note-entry';
    div.setAttribute('data-note-idx', idx);
    div.innerHTML = `
      <span class="note-time">${DP.formatTimeMMSS(note.start || 0)}</span>
      <span class="note-text">${DP.escapeHTML(note.text)}</span>
      <button class="note-delete" title="删除">✕</button>
    `;
    const textEl = div.querySelector('.note-text');
    const delBtn  = div.querySelector('.note-delete');

    function curIdx() { return parseInt(div.getAttribute('data-note-idx')); }

    // 点击时间戳 → 跳转
    div.querySelector('.note-time').addEventListener('click', (e) => {
      e.stopPropagation();
      if (DP.video.src && DP.video.duration && DP.notes[curIdx()]) {
        DP.video.currentTime = DP.notes[curIdx()].start;
      }
    });

    div.addEventListener('click', (e) => {
      if (e.target.closest('.note-delete')) return;
      // 正在编辑的文字区域被点击时不打断
      if (e.target.closest('.note-text[contenteditable="true"]')) return;
      DP.notesList.querySelectorAll('.note-entry.selected').forEach(el => {
        el.classList.remove('selected');
        const t = el.querySelector('.note-text');
        if (t) t.contentEditable = 'false';
      });
      if (!div.classList.contains('selected')) {
        div.classList.add('selected');
      }
    });

    // 双击编辑
    div.addEventListener('dblclick', (e) => {
      if (e.target.closest('.note-text')) {
        DP.pushNotesUndo();
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

    // 编辑完成
    textEl.addEventListener('blur', () => {
      if (textEl.contentEditable === 'true') {
        textEl.contentEditable = 'false';
        const i = curIdx();
        const newText = textEl.textContent.trim();
        if (newText && newText !== DP.notes[i].text) {
          DP.notes[i].text = newText;
          DP.notesDirty = true;
          DP.saveNotesToStorage();
        }
      }
    });

    // 删除
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DP.pushNotesUndo();
      DP.notes.splice(curIdx(), 1);
      DP.notesDirty = true;
      DP.renderNotes();
      DP.saveNotesToStorage();
    });

    DP.notesList.appendChild(div);
  });
  DP.applyNotesSearch();  // 渲染后重新应用搜索过滤
};

// ---- 搜索笔记 ----
DP.applyNotesSearch = function() {
  const query = DP.notesSearchBox.value.trim().toLowerCase();
  DP.notesList.querySelectorAll('.note-entry').forEach(el => {
    const textEl = el.querySelector('.note-text');
    const text = textEl ? (textEl.textContent || '') : '';
    if (!query) {
      el.style.display = '';
      if (textEl) textEl.innerHTML = DP.escapeHTML(DP.notes[parseInt(el.getAttribute('data-note-idx'))]?.text || '');
    } else if (text.toLowerCase().includes(query)) {
      el.style.display = '';
      if (textEl) textEl.innerHTML = DP.highlightText(DP.notes[parseInt(el.getAttribute('data-note-idx'))]?.text || '', query);
    } else {
      el.style.display = 'none';
    }
  });
};

// ---- 保存/恢复 ----
DP.notesGlobalKey = function() {
  return 'dp_notes_' + (DP.currentVideoName || '_none');
};

DP.saveNotesToStorage = function() {
  try {
    const json = JSON.stringify(DP.notes);
    localStorage.setItem(DP.notesKey(), json);
    localStorage.setItem(DP.notesGlobalKey(), json);
    DP.touchVideo(DP.currentVideoName);
  } catch(e) { /* ignore */ }
};

DP.loadNotesFromStorage = function() {
  try {
    let data = localStorage.getItem(DP.notesKey());
    // 跨 session 恢复：有 session 优先，没有就找全局
    if (!data) data = localStorage.getItem(DP.notesGlobalKey());
    if (data) { DP.notes = JSON.parse(data); DP.touchVideo(DP.currentVideoName); }
  } catch(e) { DP.notes = []; }
};

// ---- 导出 TXT（含字幕 + 笔记） ----
DP.exportNotesTXT = function() {
  if (DP.notes.length === 0) { DP.showToast('⚠ 笔记为空，无法导出'); return; }
  const lines = DP.notes.map(n => '[' + DP.formatTimeMMSS(n.start || 0) + '] ' + n.text);
  const txt = lines.join('\n');
  const name = (DP.currentVideoName || 'notes').replace(/\.[^.]+$/, '') + '_笔记.txt';
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  DP.showToast('📥 已导出 ' + name);
};

// ---- 切换笔记模式 ----
DP.btnNotes.addEventListener('click', () => {
  DP.notesMode = !DP.notesMode;
  DP.btnNotes.style.opacity = DP.notesMode ? '1' : '';
  DP.transcriptPanel.classList.toggle('notes-mode', DP.notesMode);

  if (DP.notesMode) {
    DP.loadNotesFromStorage();
    DP.notesUndo = [];
    DP.notesRedo = [];
    DP.renderNotes();
    // 默认分界：字幕 36% / 笔记 64%
    DP.transcriptList.style.flex = '0 0 36%';
    DP.notesContainer.style.flex = '0 0 64%';
    DP.showToast('📝 笔记模式');
  } else {
    DP.saveNotesToStorage();
    DP.transcriptList.style.flex = '';
    DP.notesContainer.style.flex = '';
    DP.showToast('📝 已退出笔记模式');
  }
  try { localStorage.setItem('dp_notes_mode', DP.notesMode ? '1' : '0'); } catch(e) {}
});

// 启动：读取上次笔记开关状态（默认开启）
(function() {
  let saved = '1';  // 首次使用默认开
  try { const v = localStorage.getItem('dp_notes_mode'); if (v !== null) saved = v; } catch(e) {}
  if (saved !== '1') return;
  DP.notesMode = true;
  DP.transcriptPanel.classList.add('notes-mode');
  DP.transcriptList.style.flex = '0 0 36%';
  DP.notesContainer.style.flex = '0 0 64%';
  DP.loadNotesFromStorage();
  DP.renderNotes();
  DP.btnNotes.style.opacity = '1';
})();

// ---- 新建笔记（带当前时间戳） ----
DP.btnNotesNew.addEventListener('click', () => {
  if (!DP.notesMode) return;
  DP.pushNotesUndo();
  const t = DP.video.currentTime || 0;
  DP.notes.push({ start: t, text: '[新笔记]' });
  // 按时间排序
  DP.notes.sort((a, b) => a.start - b.start);
  DP.notesDirty = true;
  DP.renderNotes();
  // 自动选中并编辑新条目
  const entries = DP.notesList.querySelectorAll('.note-entry');
  const target = [...entries].find(el => {
    const i = parseInt(el.getAttribute('data-note-idx'));
    return DP.notes[i] && DP.notes[i].start === t && DP.notes[i].text === '[新笔记]';
  });
  if (target) {
    target.classList.add('selected');
    const textEl = target.querySelector('.note-text');
    textEl.contentEditable = 'true';
    textEl.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    sel.addRange(range);
  }
  DP.saveNotesToStorage();
  DP.showToast('➕ 已新建笔记 @ ' + DP.formatTimeMMSS(t));
});

// ---- 撤销 ----
DP.btnNotesUndo.addEventListener('click', () => {
  if (!DP.notesMode || DP.notesUndo.length === 0) { DP.showToast('⚠ 没有可撤销的操作'); return; }
  DP.notesRedo.push(DP.notes.map(n => ({ start: n.start, text: n.text })));
  DP.notes = DP.notesUndo.pop();
  DP.notesDirty = true;
  DP.renderNotes();
  DP.saveNotesToStorage();
  DP.showToast('↩ 笔记已撤销');
});

// ---- 重做 ----
DP.btnNotesRedo.addEventListener('click', () => {
  if (!DP.notesMode || DP.notesRedo.length === 0) { DP.showToast('⚠ 没有可重做的操作'); return; }
  DP.notesUndo.push(DP.notes.map(n => ({ start: n.start, text: n.text })));
  DP.notes = DP.notesRedo.pop();
  DP.notesDirty = true;
  DP.renderNotes();
  DP.saveNotesToStorage();
  DP.showToast('↪ 笔记已重做');
});

// ---- 保存（优先写文件，否则 localStorage） ----
DP.btnNotesSave.addEventListener('click', async () => {
  if (!DP.notesMode) return;
  const txt = DP.notes.map(n => '[' + DP.formatTimeMMSS(n.start || 0) + '] ' + n.text).join('\n');

  // 尝试 File System Access API 写回文件
  if (window.showSaveFilePicker) {
    try {
      async function doSave() {
        if (DP.notesFileHandle) {
          const name = (await DP.notesFileHandle.getFile()).name;
          const h = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: '文本文件', accept: { 'text/plain': ['.txt'] } }],
            startIn: DP.notesFileHandle,
          });
          DP.notesFileHandle = h;
        } else {
          const name = (DP.currentVideoName || 'notes').replace(/\.[^.]+$/, '') + '_笔记.txt';
          DP.notesFileHandle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: '文本文件', accept: { 'text/plain': ['.txt'] } }],
            startIn: DP.lastVideoHandle || DP.subFileHandle || 'documents',
          });
        }
        const writable = await DP.notesFileHandle.createWritable();
        try { await writable.write(txt); } finally { await writable.close(); }
        return true;
      }
      const ok = await doSave();
      if (ok) {
        DP.saveNotesToStorage();  // 同步 localStorage
        DP.notesDirty = false;
        DP.showToast('💾 笔记已保存到文件');
        return;
      }
    } catch(e) {
      if (e.name === 'AbortError') { DP.showToast('⚠ 已取消保存'); return; }
    }
  }
  // 回退
  DP.saveNotesToStorage();
  DP.notesDirty = false;
  DP.showToast('💾 笔记已保存到浏览器');
});

// ---- 导出 ----
DP.btnNotesExport.addEventListener('click', () => {
  if (!DP.notesMode) return;
  DP.exportNotesTXT();
});

// ---- 上传笔记 ----
DP.parseNotesTXT = function(text) {
  const notes = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('===')) continue;
    const match = trimmed.match(/^\[(\d{1,3}):(\d{2})\]\s*(.*)/);
    if (match) {
      notes.push({ start: parseInt(match[1]) * 60 + parseInt(match[2]), text: match[3] || '' });
    } else {
      notes.push({ start: 0, text: trimmed });
    }
  }
  return notes;
};

DP.btnOpenNotes.addEventListener('click', async () => {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: '文本文件', accept: { 'text/plain': ['.txt'] } }],
        multiple: false,
        startIn: DP.notesFileHandle || DP.lastVideoHandle || 'documents',
      });
      const file = await handle.getFile();
      const text = await file.text();
      const parsed = DP.parseNotesTXT(text);
      if (parsed.length === 0) { DP.showToast('⚠ 未识别到笔记内容'); return; }
      DP.notes = parsed;
      DP.notesFileHandle = handle;
      DP.notesDirty = false;
      DP.renderNotes();
      DP.saveNotesToStorage();
      DP.showToast('📝 已加载 ' + parsed.length + ' 条笔记');
    } catch(e) {
      if (e.name === 'AbortError') return;
    }
  } else {
    DP.notesFileInput.click();
  }
});

DP.notesFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  DP.notesFileHandle = null;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = DP.parseNotesTXT(reader.result);
    if (parsed.length === 0) { DP.showToast('⚠ 未识别到笔记内容'); return; }
    DP.notes = parsed;
    DP.notesDirty = false;
    DP.renderNotes();
    DP.saveNotesToStorage();
    DP.showToast('📝 已加载 ' + parsed.length + ' 条笔记');
  };
  reader.readAsText(file, 'UTF-8');
});

// 清除笔记
DP.btnNotesClear.addEventListener('click', () => {
  if (!DP.notesMode) return;
  if (DP.notes.length === 0) { DP.showToast('⚠ 笔记已为空'); return; }
  if (!confirm('确定要清除当前视频的全部笔记吗？此操作不可撤销。')) return;
  DP.notes = [];
  DP.notesUndo = [];
  DP.notesRedo = [];
  DP.notesDirty = false;
  DP.renderNotes();
  try { localStorage.removeItem(DP.notesKey()); } catch(e) {}
  DP.showToast('🗑 笔记已清除');
});

// 笔记搜索
DP.notesSearchBox.addEventListener('input', DP.applyNotesSearch);
