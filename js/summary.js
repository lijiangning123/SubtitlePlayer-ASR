window.DP = window.DP || {};

// ==================== 字幕总结 ====================

(function() {
  const SUMMARY_ENDPOINT = 'http://127.0.0.1:28888/api/summarize';
  const SUMMARY_CONFIG_ENDPOINT = 'http://127.0.0.1:28888/api/summary-config';
  const PROVIDER_DEFAULTS = {
    openai: {
      model: 'gpt-5.2',
      baseUrl: 'https://api.openai.com/v1',
      help: 'ChatGPT / OpenAI：官方地址用 https://api.openai.com/v1。中转站可填根地址或 /v1 地址，程序会自动尝试 /v1/chat/completions。'
    },
    qwen: {
      model: 'qwen-plus',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      help: '通义千问：到阿里云百炼控制台创建 API Key。常用模型 qwen-plus。'
    },
    doubao: {
      model: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      help: '豆包：到火山方舟控制台创建 API Key，并填入控制台中的模型或 endpoint id。'
    },
    deepseek: {
      model: 'deepseek-v4-flash',
      baseUrl: 'https://api.deepseek.com',
      help: 'DeepSeek：到 platform.deepseek.com 创建 API Key。常用模型 deepseek-v4-flash；需要更强能力可改 deepseek-v4-pro。'
    },
    custom: {
      model: '',
      baseUrl: '',
      help: '自定义：适合中转站。Base URL 可填根地址或 /v1 地址；模型名必须按中转站模型列表填写。'
    }
  };
  const STOPWORDS = new Set([
    '这个','那个','然后','就是','我们','你们','他们','它们','因为','所以','如果','但是','还是','可以','可能','没有','不是','已经',
    '进行','通过','一个','一些','一种','这里','那里','这些','那些','什么','怎么','时候','现在','其实','大家','比较','需要','以及',
    '或者','对于','里面','出来','这种','这样','那么','非常','的话','一下','比如','由于','因此','并且','而且','同时','首先','最后',
    'the','and','that','this','with','from','you','your','are','was','were','for','not','but','can','will','have','has','into','about'
  ]);

  function cleanText(text) {
    return String(text || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\.*?\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cueToSentence(cue) {
    return {
      start: cue.start,
      end: cue.end,
      text: cleanText(cue.text)
    };
  }

  function splitCueText(cue) {
    const parts = cue.text
      .split(/(?<=[。！？!?；;])\s*|\n+/)
      .map(cleanText)
      .filter(Boolean);
    if (parts.length === 0 && cue.text) return [cue];
    return parts.map(text => ({ start: cue.start, end: cue.end, text }));
  }

  function buildSentences() {
    return (DP.subtitles || [])
      .map(cueToSentence)
      .filter(cue => cue.text.length > 0)
      .flatMap(splitCueText)
      .filter(cue => cue.text.length >= 4);
  }

  function tokenize(text) {
    const normalized = cleanText(text).toLowerCase();
    const tokens = [];
    if (window.Intl && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
      for (const item of segmenter.segment(normalized)) {
        const word = item.segment.trim();
        if (!item.isWordLike || word.length < 2 || STOPWORDS.has(word)) continue;
        tokens.push(word);
      }
      if (tokens.length > 0) return tokens;
    }

    const latin = normalized.match(/[a-z0-9][a-z0-9-]{1,}/g) || [];
    latin.forEach(word => { if (!STOPWORDS.has(word)) tokens.push(word); });

    const chineseRuns = normalized.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    chineseRuns.forEach(run => {
      for (let i = 0; i < run.length - 1; i++) {
        const word = run.slice(i, i + 2);
        if (!STOPWORDS.has(word)) tokens.push(word);
      }
    });
    return tokens;
  }

  function keywordStats(sentences) {
    const freq = new Map();
    sentences.forEach(sentence => {
      tokenize(sentence.text).forEach(token => {
        freq.set(token, (freq.get(token) || 0) + 1);
      });
    });
    return Array.from(freq.entries())
      .filter(([word, count]) => count >= 2 && word.length <= 12)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'));
  }

  function scoreSentence(sentence, keywordMap) {
    const words = tokenize(sentence.text);
    if (words.length === 0) return 0;
    const keywordScore = words.reduce((sum, word) => sum + Math.min(keywordMap.get(word) || 0, 8), 0) / Math.sqrt(words.length);
    const lengthScore = Math.min(sentence.text.length, 80) / 80;
    const signalScore = /重点|核心|关键|结论|原因|方法|步骤|问题|注意|建议|总结|所以|因此|首先|最后/.test(sentence.text) ? 2 : 0;
    return keywordScore + lengthScore + signalScore;
  }

  function pickTopSentences(sentences, keywords, limit) {
    const keywordMap = new Map(keywords);
    const seen = new Set();
    return sentences
      .map(sentence => ({ ...sentence, score: scoreSentence(sentence, keywordMap) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter(item => {
        const compact = item.text.replace(/\W/g, '').slice(0, 40);
        if (seen.has(compact)) return false;
        seen.add(compact);
        return true;
      })
      .slice(0, limit)
      .sort((a, b) => a.start - b.start);
  }

  function buildChapters(sentences, keywords) {
    if (sentences.length === 0) return [];
    const maxEnd = Math.max(...sentences.map(item => item.end || item.start || 0));
    const minStart = Math.min(...sentences.map(item => item.start || 0));
    const duration = Math.max(1, maxEnd - minStart);
    const targetCount = Math.max(4, Math.min(10, Math.ceil(duration / 360)));
    const blockSize = Math.max(180, duration / targetCount);
    const blocks = [];

    sentences.forEach(sentence => {
      const idx = Math.min(targetCount - 1, Math.floor((sentence.start - minStart) / blockSize));
      if (!blocks[idx]) {
        blocks[idx] = {
          start: minStart + idx * blockSize,
          end: Math.min(maxEnd, minStart + (idx + 1) * blockSize),
          sentences: []
        };
      }
      blocks[idx].sentences.push(sentence);
    });

    return blocks.filter(Boolean).map(block => {
      const picks = pickTopSentences(block.sentences, keywords, 2);
      return {
        start: block.sentences[0]?.start ?? block.start,
        end: block.sentences[block.sentences.length - 1]?.end ?? block.end,
        text: picks.length > 0 ? picks.map(item => item.text).join(' ') : block.sentences.slice(0, 2).map(item => item.text).join(' ')
      };
    });
  }

  function formatKeywordLine(keywords) {
    return keywords.slice(0, 18).map(([word, count]) => `${word}(${count})`).join('、') || '暂无明显高频词';
  }

  function buildSummaryText() {
    const sentences = buildSentences();
    if (sentences.length === 0) return '';

    const keywords = keywordStats(sentences);
    const highlights = pickTopSentences(sentences, keywords, Math.min(10, Math.max(5, Math.ceil(sentences.length / 18))));
    const chapters = buildChapters(sentences, keywords);
    const videoName = DP.currentVideoName || '当前视频';
    const totalTextLength = sentences.reduce((sum, item) => sum + item.text.length, 0);
    const start = sentences[0]?.start || 0;
    const end = sentences[sentences.length - 1]?.end || sentences[sentences.length - 1]?.start || 0;

    const lines = [];
    lines.push(`# ${videoName} - 字幕总结`);
    lines.push('');
    lines.push(`生成依据：${DP.subtitles.length} 条字幕，约 ${Math.max(1, Math.round(totalTextLength / 450))} 分钟阅读量，覆盖 ${DP.formatTime(start)} - ${DP.formatTime(end)}。`);
    lines.push('');
    lines.push('## 一句话概览');
    lines.push(highlights[0] ? highlights[0].text : sentences[0].text);
    lines.push('');
    lines.push('## 核心重点');
    highlights.slice(0, 8).forEach((item, idx) => {
      lines.push(`${idx + 1}. [${DP.formatTime(item.start)}] ${item.text}`);
    });
    lines.push('');
    lines.push('## 分段理解');
    chapters.forEach((chapter, idx) => {
      lines.push(`${idx + 1}. ${DP.formatTime(chapter.start)} - ${DP.formatTime(chapter.end)}：${chapter.text}`);
    });
    lines.push('');
    lines.push('## 高频关键词');
    lines.push(formatKeywordLine(keywords));
    lines.push('');
    lines.push('## 复习建议');
    lines.push('- 先通读“核心重点”，建立整节课的主线。');
    lines.push('- 再按“分段理解”的时间点回看不熟悉片段。');
    lines.push('- 用“高频关键词”反查字幕，定位反复出现的概念、方法或问题。');
    return lines.join('\n');
  }

  function buildSubtitlePayload() {
    return (DP.subtitles || []).map(item => ({
      start: item.start,
      end: item.end,
      text: cleanText(item.text)
    })).filter(item => item.text);
  }

  async function summarizeWithService() {
    const subtitles = buildSubtitlePayload();
    const resp = await DP.fetchWithTimeout(SUMMARY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoName: DP.currentVideoName || '',
        subtitles
      })
    }, 360000);

    let data = {};
    try {
      data = await resp.json();
    } catch (e) {}

    if (!resp.ok) {
      throw new Error(data.detail || ('总结服务请求失败：HTTP ' + resp.status));
    }
    if (!data.summary) {
      throw new Error('总结服务没有返回内容');
    }
    return data;
  }

  DP.setSummaryBusy = function setSummaryBusy(isBusy) {
    if (!DP.btnSummary) return;
    DP.btnSummary.disabled = isBusy;
    DP.btnSummary.textContent = isBusy ? '🧠 总结中...' : '🧠 总结';
  };

  function rememberSummaryProviderDraft(provider) {
    if (!provider || !DP.summaryModel || !DP.summaryBaseUrl || !DP.summaryApiKey) return;
    DP.summaryProviderDrafts = DP.summaryProviderDrafts || {};
    DP.summaryProviderDrafts[provider] = {
      model: DP.summaryModel.value.trim(),
      baseUrl: DP.summaryBaseUrl.value.trim(),
      apiKey: DP.summaryApiKey.value.trim()
    };
  }

  DP.applySummaryProviderDefaults = function applySummaryProviderDefaults(force) {
    const provider = DP.summaryProvider?.value || 'openai';
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom;
    const saved = DP.summaryConfigCache?.providers?.[provider] || {};
    const draft = DP.summaryProviderDrafts?.[provider] || {};
    DP.summaryModel.value = draft.model || saved.model || (force ? defaults.model : DP.summaryModel.value.trim() || defaults.model);
    DP.summaryBaseUrl.value = draft.baseUrl || saved.baseUrl || (force ? defaults.baseUrl : DP.summaryBaseUrl.value.trim() || defaults.baseUrl);
    DP.summaryApiKey.value = draft.apiKey || '';
    DP.summaryConfigHelp.textContent = defaults.help;
    const active = DP.summaryConfigCache?.provider || 'openai';
    const stateText = saved.apiKeySet ? '已保存 API Key。留空可保留原 Key。' : '尚未保存 API Key。';
    DP.summaryConfigStatus.textContent = (provider === active ? '当前使用：' : '已保存：') + providerLabel(provider) + '；' + stateText;
    DP.summaryLastProvider = provider;
  };

  function providerLabel(provider) {
    return {
      openai: 'ChatGPT / OpenAI',
      qwen: '通义千问',
      doubao: '豆包 / 火山方舟',
      deepseek: 'DeepSeek',
      custom: '其他 / 自定义'
    }[provider] || provider;
  }

  function activeSummaryConfig(data) {
    if (!data) return null;
    const provider = data.provider || 'openai';
    const saved = data.providers?.[provider] || {};
    return {
      provider,
      model: saved.model || data.model || '',
      apiKeySet: Boolean(saved.apiKeySet || data.apiKeySet)
    };
  }

  function updateSummaryModelStatus(data) {
    if (!DP.summaryCurrentModel) return;
    const active = activeSummaryConfig(data);
    if (!active || !active.model) {
      DP.summaryCurrentModel.textContent = '当前模型：未配置';
      DP.summaryCurrentModel.title = '打开“模型”配置用于视频总结的大模型';
      DP.summaryCurrentModel.classList.add('empty');
      return;
    }
    const label = `${providerLabel(active.provider)} / ${active.model}`;
    DP.summaryCurrentModel.textContent = `当前模型：${label}`;
    DP.summaryCurrentModel.title = active.apiKeySet ? label : `${label}（未保存 API Key）`;
    DP.summaryCurrentModel.classList.toggle('empty', !active.apiKeySet);
  }

  DP.refreshSummaryModelStatus = async function refreshSummaryModelStatus() {
    if (!DP.summaryCurrentModel) return;
    try {
      const resp = await DP.fetchWithTimeout(SUMMARY_CONFIG_ENDPOINT, { method: 'GET' }, 5000);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      DP.summaryConfigCache = data;
      updateSummaryModelStatus(data);
    } catch (err) {
      DP.summaryCurrentModel.textContent = '当前模型：服务未启动';
      DP.summaryCurrentModel.title = '请通过“字幕播放器.cmd”启动本地服务';
      DP.summaryCurrentModel.classList.add('empty');
    }
  };

  DP.openSummaryConfig = async function openSummaryConfig() {
    if (!DP.summaryConfigModal) return;
    DP.summaryConfigModal.classList.add('visible');
    DP.summaryConfigModal.setAttribute('aria-hidden', 'false');
    DP.summaryConfigStatus.textContent = '正在读取本地配置...';
    DP.summaryApiKey.value = '';
    try {
      const resp = await DP.fetchWithTimeout(SUMMARY_CONFIG_ENDPOINT, { method: 'GET' }, 5000);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      DP.summaryConfigCache = data;
      updateSummaryModelStatus(data);
      DP.summaryProvider.value = data.provider || 'openai';
      DP.summaryLastProvider = DP.summaryProvider.value;
      DP.applySummaryProviderDefaults(true);
    } catch (err) {
      DP.summaryConfigCache = null;
      DP.applySummaryProviderDefaults(false);
      DP.summaryConfigStatus.textContent = '无法连接本地服务，请先通过“字幕播放器.cmd”启动。';
    }
  };

  DP.closeSummaryConfig = function closeSummaryConfig() {
    DP.summaryConfigModal.classList.remove('visible');
    DP.summaryConfigModal.setAttribute('aria-hidden', 'true');
  };

  DP.saveSummaryConfig = async function saveSummaryConfig() {
    const payload = {
      provider: DP.summaryProvider.value,
      apiKey: DP.summaryApiKey.value.trim(),
      model: DP.summaryModel.value.trim(),
      baseUrl: DP.summaryBaseUrl.value.trim()
    };
    DP.btnSummaryConfigSave.disabled = true;
    DP.btnSummaryConfigSave.textContent = '💾 保存中...';
    try {
      const resp = await DP.fetchWithTimeout(SUMMARY_CONFIG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 10000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));
      DP.summaryConfigCache = data;
      updateSummaryModelStatus(data);
      DP.summaryProvider.value = data.provider || payload.provider;
      DP.summaryProviderDrafts[DP.summaryProvider.value] = {
        model: DP.summaryModel.value.trim(),
        baseUrl: DP.summaryBaseUrl.value.trim(),
        apiKey: ''
      };
      DP.summaryLastProvider = DP.summaryProvider.value;
      DP.applySummaryProviderDefaults(true);
      DP.summaryConfigStatus.textContent = `${providerLabel(DP.summaryProvider.value)} 已保存并设为当前使用。现在可以关闭窗口并点击“总结”。`;
      DP.showToast('✅ 模型配置已保存');
    } catch (err) {
      DP.summaryConfigStatus.textContent = '保存失败：' + err.message;
      DP.showToast('⚠ 保存模型配置失败');
    } finally {
      DP.btnSummaryConfigSave.disabled = false;
      DP.btnSummaryConfigSave.textContent = '💾 保存并使用';
    }
  };

  DP.generateVideoSummary = async function generateVideoSummary() {
    if (!DP.subtitles || DP.subtitles.length === 0) {
      DP.showToast('⚠ 请先上传或生成字幕');
      return;
    }

    DP.setSummaryBusy(true);
    DP.showToast('🧠 正在调用模型总结字幕，长视频需要等待一会儿');
    try {
      const data = await summarizeWithService();
      DP.currentSummaryText = data.summary;
      DP.summaryContent.textContent = data.summary;
      DP.summaryMeta.textContent = `${DP.currentVideoName || '当前视频'} · ${DP.subtitles.length} 条字幕 · ${data.provider || '模型'} · ${data.model || ''}`;
      DP.summaryModal.classList.add('visible');
      DP.summaryModal.setAttribute('aria-hidden', 'false');
      DP.showToast('✅ 已生成 ChatGPT/模型总结');
    } catch (err) {
      const message = err.name === 'AbortError' ? '模型总结超时，请稍后重试或换短一点的字幕' : err.message;
      DP.showToast('⚠ 总结失败：' + message);
      DP.currentSummaryText = [
        '模型总结失败',
        '',
        message,
        '',
        '请确认：',
        '1. 已通过“字幕播放器.cmd”启动本地服务。',
        '2. 已在 asr-service/summary-config.json 中配置 ChatGPT / 豆包 / 千问的 API Key 和模型。',
        '3. 当前网络可以访问所选模型服务。'
      ].join('\n');
      DP.summaryContent.textContent = DP.currentSummaryText;
      DP.summaryMeta.textContent = `${DP.currentVideoName || '当前视频'} · 配置检查`;
      DP.summaryModal.classList.add('visible');
      DP.summaryModal.setAttribute('aria-hidden', 'false');
    } finally {
      DP.setSummaryBusy(false);
    }
  };

  DP.closeSummary = function closeSummary() {
    DP.summaryModal.classList.remove('visible');
    DP.summaryModal.setAttribute('aria-hidden', 'true');
  };

  DP.copySummary = async function copySummary() {
    if (!DP.currentSummaryText) return;
    try {
      await navigator.clipboard.writeText(DP.currentSummaryText);
      DP.showToast('📋 总结已复制');
    } catch (e) {
      DP.showToast('⚠ 复制失败，可手动选中复制');
    }
  };

  DP.exportSummary = function exportSummary() {
    if (!DP.currentSummaryText) return;
    const blob = new Blob([DP.currentSummaryText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (DP.currentVideoName || 'video').replace(/\.[^.]+$/, '') + '.summary.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
    DP.showToast('📥 已导出总结');
  };

  if (DP.btnSummary) DP.btnSummary.addEventListener('click', DP.generateVideoSummary);
  if (DP.btnSummaryConfig) DP.btnSummaryConfig.addEventListener('click', DP.openSummaryConfig);
  if (DP.summaryProvider) DP.summaryProvider.addEventListener('change', () => {
    rememberSummaryProviderDraft(DP.summaryLastProvider);
    DP.applySummaryProviderDefaults(true);
  });
  if (DP.btnSummaryConfigClose) DP.btnSummaryConfigClose.addEventListener('click', DP.closeSummaryConfig);
  if (DP.btnSummaryConfigSave) DP.btnSummaryConfigSave.addEventListener('click', DP.saveSummaryConfig);
  if (DP.btnSummaryClose) DP.btnSummaryClose.addEventListener('click', DP.closeSummary);
  if (DP.btnSummaryCopy) DP.btnSummaryCopy.addEventListener('click', DP.copySummary);
  if (DP.btnSummaryExport) DP.btnSummaryExport.addEventListener('click', DP.exportSummary);
  DP.refreshSummaryModelStatus();
  if (DP.summaryModal) {
    DP.summaryModal.addEventListener('click', (event) => {
      if (event.target === DP.summaryModal) DP.closeSummary();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && DP.summaryModal?.classList.contains('visible')) DP.closeSummary();
    if (event.key === 'Escape' && DP.summaryConfigModal?.classList.contains('visible')) DP.closeSummaryConfig();
  });
})();
