window.DP = window.DP || {};

/** 解析 SRT 字幕 */
DP.parseSRT = function(text) {
  const cues = [];
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    // 跳过 index 行（纯数字）
    let i = 0;
    if (/^\d+$/.test(lines[0].trim())) i = 1;
    // 时间行
    const timeMatch = lines[i]?.match(/([\d:,:.]+)\s*-->\s*([\d:,:.]+)/);
    if (!timeMatch) continue;
    const start = DP.parseTimeToSeconds(timeMatch[1]);
    const end   = DP.parseTimeToSeconds(timeMatch[2]);
    const content = lines.slice(i + 1).join('\n').trim();
    // 去除 HTML 标签
    const cleanText = content.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    if (cleanText) {
      cues.push({ start, end, text: cleanText });
    }
  }
  return cues;
};

/** 解析 WebVTT 字幕 */
DP.parseVTT = function(text) {
  const cues = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  // 跳过 WEBVTT 头部
  if (lines[0]?.trim().startsWith('WEBVTT')) i = 1;
  // 跳过头部元数据
  while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().includes('-->')) i++;
  // 跳过空行
  while (i < lines.length && lines[i].trim() === '') i++;

  let currentCue = null;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      if (currentCue && currentCue.text) {
        cues.push(currentCue);
      }
      currentCue = null;
      continue;
    }
    const timeMatch = line.match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (timeMatch) {
      if (currentCue && currentCue.text) {
        cues.push(currentCue);
      }
      currentCue = {
        start: DP.parseTimeToSeconds(timeMatch[1]),
        end:   DP.parseTimeToSeconds(timeMatch[2]),
        text:  ''
      };
    } else if (currentCue) {
      // 跳过 VTT 标签（如 NOTE, STYLE 等）
      if (/^[A-Z]+:/.test(line) || line.startsWith('NOTE')) continue;
      const clean = line.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      currentCue.text += (currentCue.text ? '\n' : '') + clean;
    }
  }
  if (currentCue && currentCue.text) {
    cues.push(currentCue);
  }
  return cues;
};

/** 解析 TXT 字幕（[分:秒] 文本 或纯文本逐行） */
DP.parseTXT = function(text) {
  const cues = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\[(\d{1,3}):(\d{2})(?::(\d{2}))?\]\s*(.*)/);
    if (match) {
      const h = match[3] ? parseInt(match[1]) : 0;
      const m = match[3] ? parseInt(match[2]) : parseInt(match[1]);
      const s = match[3] ? parseInt(match[3]) : parseInt(match[2]);
      const start = h * 3600 + m * 60 + s;
      const text = match[4] || '';
      if (text) cues.push({ start, end: start + 5, text });
    } else {
      cues.push({ start: 0, end: 5, text: trimmed });
    }
  }
  return cues;
};

/** 检测是否为 TXT 格式（不含 SRT 时间箭头 -->，含 [MM:SS] 行或纯文本） */
DP.isTXTFormat = function(text) {
  return !text.includes('-->');
};

/** 检测并解析字幕文本 */
DP.parseSubtitles = function(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('WEBVTT')) {
    return DP.parseVTT(trimmed);
  }
  if (DP.isTXTFormat(trimmed)) {
    return DP.parseTXT(trimmed);
  }
  return DP.parseSRT(trimmed);
};

/** 字幕存储 key（按视频） */
DP.subKey = function(videoName) {
  return DP.sessionKey('sub_' + (videoName || DP.currentVideoName || '_none'));
};
DP.subGlobalKey = function(videoName) {
  return 'dp_sub_' + (videoName || DP.currentVideoName || '_none');
};

/** 保存字幕到 localStorage */
DP.saveSubtitlesToStorage = function() {
  try {
    DP.fixSubtitleOverlaps();
    const cues = DP.subtitles.map(function(s) { return { start: s.start, end: s.end, text: s.text }; });
    const json = JSON.stringify(cues);
    localStorage.setItem(DP.subKey(), json);
    localStorage.setItem(DP.subGlobalKey(), json);
    DP.touchVideo(DP.currentVideoName);
  } catch(e) { /* ignore */ }
};

/** 按视频名加载字幕 */
DP.loadSubtitlesForVideo = function(videoName) {
  try {
    let data = localStorage.getItem(DP.subKey(videoName));
    if (!data) data = localStorage.getItem(DP.subGlobalKey(videoName));
    if (data) {
      const cues = JSON.parse(data);
      DP.subtitles = cues.map(function(cue, idx) {
        return { id: idx, start: cue.start, end: cue.end, text: cue.text, element: null };
      });
      DP.rebuildTranscript();
      DP.rebuildTimelineMarkers();
      DP.updateSubCount();
      DP.touchVideo(videoName);
      return true;
    }
  } catch(e) { /* ignore */ }
  // 没存档 → 清空
  DP.subtitles = [];
  DP.currentSubIdx = -1;
  DP.ccText.textContent = '';
  DP.rebuildTranscript();
  DP.rebuildTimelineMarkers();
  DP.updateSubCount();
  DP.transcriptEmpty.style.display = 'block';
  return false;
};

/** 从文本加载字幕 */
DP.loadSubtitlesFromText = function(text, filename) {
  const cues = DP.parseSubtitles(text);
  if (cues.length === 0) {
    DP.showToast('⚠ 未能解析到字幕内容，请检查文件格式');
    return;
  }
  cues.sort(function(a, b) { return a.start - b.start; });
  DP.subtitles = cues.map(function(cue, idx) {
    return {
      id: idx,
      start: cue.start,
      end: cue.end,
      text: cue.text,
      element: null
    };
  });
  DP.rebuildTranscript();
  DP.rebuildTimelineMarkers();
  DP.updateSubCount();
  DP.showToast('✅ 已加载 ' + DP.subtitles.length + ' 条字幕 (' + (filename || '字幕文件') + ')');
  console.log('📄 字幕加载: ' + DP.subtitles.length + ' 条, 来源: ' + (filename || '未知'));
  DP.saveSubtitlesToStorage();
  if (filename) localStorage.setItem(DP.sessionKey('sub_name'), filename);
};
