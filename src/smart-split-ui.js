// 一键分章界面：把整篇文本或粘贴的抓取内容交给 smart-split，
// 先展示识别依据、杂讯处理和体检结果，再由作者决定是否应用；应用前自动备份原稿。
import {smartSplit, prepareSource, applySmartSplit, draftText} from './smart-split.js';
import {LLM_PROVIDERS, providerById} from './llm-providers.js';
import {listLlmModels, normalizeLlmConfig, describeLlmConfig} from './llm-client.js';
import {llmChapterLines} from './llm-chapter-service.js';
import {loadLlmSettings, saveLlmSettings, clearLlmSettings, llmConfig, llmStatusText, hasLlmKey} from './llm-settings.js';

let llm = loadLlmSettings();

const $ = selector => document.querySelector(selector);
const chars = value => Number(value || 0).toLocaleString();

export function smartSplitMarkup({chapters = [], characters = 0} = {}) {
  return `<section class="smart-split-panel" id="smart-split-panel">
  <div class="smart-split-intro">
    <strong>一键智能分章</strong>
    <p>贴吧、转载站直接复制来的长文，先过滤楼层、广告与翻页，再按反复出现的标题结构整篇分章。默认完全离线，正文逐字保留。</p>
    <small>当前草稿 ${chapters.length} 章 · ${chars(characters)} 字 · 识别只提出标题行，不改写文字。</small>
  </div>
  <div class="smart-split-actions">
    <button class="primary" id="smart-split-open">一键分章</button>
    <button id="llm-settings-open">大模型设置</button>
    <span class="llm-state" id="llm-state">${llmStatusText(llm)}</span>
  </div>
</section>`;
}

function providerOptions(selected) {
  return LLM_PROVIDERS.map(provider => `<option value="${provider.id}" ${provider.id === selected ? 'selected' : ''}>${provider.label}${provider.needsKey ? '' : ' · 本地'}</option>`).join('');
}

function settingsMarkup() {
  const preset = providerById(llm.provider);
  return `<div class="smart-dialog"><span class="eyebrow">OPTIONAL CONNECTOR</span><h2>大模型分章设置</h2>
  <p>可选功能：让大模型指出哪一行是章节标题。识别结果仍要经过离线结构引擎在原文上验证，模型不能改写正文。</p>
  <div class="llm-form">
    <label>服务商<select id="llm-provider">${providerOptions(llm.provider)}</select></label>
    <label>服务地址<input id="llm-base" value="${llm.baseUrl || preset.baseUrl}" placeholder="https://api.example.com/v1" spellcheck="false"></label>
    <label>模型名称<input id="llm-model" list="llm-models" value="${llm.model}" placeholder="${preset.models[0] || 'model-name'}" spellcheck="false"><datalist id="llm-models">${preset.models.map(model => `<option value="${model}"></option>`).join('')}</datalist></label>
    <label>API 密钥<input id="llm-key" type="password" autocomplete="off" spellcheck="false" value="${llm.apiKey}" placeholder="${preset.needsKey ? 'sk-...' : '本地服务可留空'}"></label>
    <label>采样温度<input id="llm-temp" type="range" min="0" max="1" step="0.1" value="${llm.temperature}"></label>
    <label class="llm-remember"><input type="checkbox" id="llm-remember" ${llm.remember ? 'checked' : ''}> 在这台设备记住密钥（不勾选则只在本次会话有效）</label>
  </div>
  <p class="llm-note" id="llm-note">${preset.note || ''}</p>
  <div class="actions"><button id="llm-test">测试连接</button><button id="llm-list">获取模型列表</button><button class="primary" id="llm-save">保存设置</button><button id="llm-clear">清除密钥</button><button data-action="close">关闭</button></div>
  <p class="llm-status" id="llm-status" role="status"></p>
  <small>密钥只保存在本机存储，不会写入草稿备份、公开作品或导出文件。只有点击“使用大模型识别标题”时才会把清洗后的正文片段发送给该服务商；不联网时一键分章仍可用离线规则。</small></div>`;
}

function readSettingsForm() {
  return {
    provider: $('#llm-provider').value,
    baseUrl: $('#llm-base').value.trim(),
    model: $('#llm-model').value.trim(),
    apiKey: $('#llm-key').value.trim(),
    temperature: Number($('#llm-temp').value),
    remember: $('#llm-remember').checked
  };
}

function openLlmSettings({modal, toast}) {
  modal(settingsMarkup());
  const status = message => {
    const node = $('#llm-status');
    if (node) node.textContent = message;
  };
  $('#llm-provider').onchange = () => {
    const preset = providerById($('#llm-provider').value);
    $('#llm-base').value = preset.baseUrl;
    $('#llm-model').value = preset.models[0] || '';
    $('#llm-models').innerHTML = preset.models.map(model => `<option value="${model}"></option>`).join('');
    $('#llm-key').placeholder = preset.needsKey ? 'sk-...' : '本地服务可留空';
    $('#llm-note').textContent = preset.note || '';
    status('');
  };
  $('#llm-save').onclick = () => {
    try {
      const settings = readSettingsForm();
      normalizeLlmConfig(llmConfig(settings));
      if (!saveLlmSettings(settings)) throw Error('本机存储不可用，密钥只在本次会话有效');
      llm = loadLlmSettings();
      const state = $('#llm-state');
      if (state) state.textContent = llmStatusText(llm);
      status('设置已保存：' + describeLlmConfig(llmConfig(llm)));
    } catch (error) {
      status(error.message);
    }
  };
  $('#llm-clear').onclick = () => {
    clearLlmSettings();
    llm = loadLlmSettings();
    $('#llm-key').value = '';
    status('已清除本机保存的密钥与设置');
    const state = $('#llm-state');
    if (state) state.textContent = llmStatusText(llm);
  };
  $('#llm-list').onclick = async () => {
    try {
      status('正在获取模型列表…');
      const models = await listLlmModels(llmConfig(readSettingsForm()));
      if (!models.length) return status('服务没有返回模型列表');
      $('#llm-models').innerHTML = models.map(model => `<option value="${model}"></option>`).join('');
      if (!$('#llm-model').value) $('#llm-model').value = models[0];
      status(`可用模型 ${models.length} 个：` + models.slice(0, 6).join('、'));
    } catch (error) {
      status(error.message);
    }
  };
  $('#llm-test').onclick = async () => {
    try {
      status('正在测试连接…');
      const models = await listLlmModels(llmConfig(readSettingsForm()));
      status(models.length ? `连接成功，服务返回 ${models.length} 个模型` : '连接成功，但服务没有返回模型列表');
    } catch (error) {
      status(error.message);
    }
  };
}

export function bindSmartSplit({getDraft, commit, modal, esc, toast}) {
  const open = $('#smart-split-open');
  const configure = $('#llm-settings-open');
  if (!open || !configure) return;
  configure.onclick = () => openLlmSettings({modal, toast});
  open.onclick = () => openSmartSplit({getDraft, commit, modal, esc, toast});
}

function openSmartSplit({getDraft, commit, modal, esc, toast}) {
  const source = getDraft();
  if (!source) return toast('请先新建或恢复一部草稿');
  const fullText = draftText(source.chapters);
  modal(`<div class="smart-dialog"><span class="eyebrow">SMART CHAPTERING</span><h2>一键分章</h2>
  <p>整篇文本会先过滤站点杂讯，再识别标题结构并重新切分；正文逐字来自原文，应用前自动备份。</p>
  <label>分章素材<select id="smart-source"><option value="draft">当前草稿全文（${chars(fullText.length)} 字）</option><option value="paste">粘贴新文本</option></select></label>
  <label id="smart-paste-wrap" hidden>粘贴文本<textarea id="smart-paste" rows="7" placeholder="把从贴吧 / 网页复制来的正文粘贴到这里……" spellcheck="false"></textarea></label>
  <fieldset class="smart-options">
    <label><input type="checkbox" id="smart-clean" checked> 过滤站点杂讯（楼层、广告、翻页、时间、客户端签名）</label>
    <label><input type="checkbox" id="smart-merge" checked> 合并明显过短的碎章，少于 <input id="smart-min" type="number" min="100" max="5000" step="50" value="400"> 字</label>
    <label><input type="checkbox" id="smart-breaks"> 为超过 4500 字的章节生成断点建议（不直接拆分）</label>
    <label><input type="checkbox" id="smart-llm"> 使用大模型识别标题（需联网，正文片段会发送给 ${esc(describeLlmConfig(llmConfig(llm))) }）</label>
  </fieldset>
  <p class="smart-status" id="smart-status" role="status">离线规则在本机运行，不会上传正文。</p>
  <div class="actions"><button class="primary" id="smart-run">开始分析</button><button id="smart-cancel" hidden>取消请求</button><button data-action="close">关闭</button></div>
  <div id="smart-preview"></div></div>`);

  const status = message => {
    const node = $('#smart-status');
    if (node) node.textContent = message;
  };
  $('#smart-source').onchange = () => {
    $('#smart-paste-wrap').hidden = $('#smart-source').value !== 'paste';
  };
  $('#smart-llm').onchange = () => {
    if (!$('#smart-llm').checked) return status('离线规则在本机运行，不会上传正文。');
    const ready = hasLlmKey(llm) || llm.provider === 'ollama' || llm.provider === 'lmstudio';
    status(ready
      ? `将把清洗后的正文发送给 ${describeLlmConfig(llmConfig(llm))}；模型只返回标题行号。`
      : '尚未配置大模型，请先点“大模型设置”；也可以直接使用离线规则。');
  };

  let controller = null;
  let result = null;

  $('#smart-cancel').onclick = () => {
    controller?.abort();
    status('已取消本次请求');
  };

  $('#smart-run').onclick = async () => {
    const button = $('#smart-run');
    button.disabled = true;
    $('#smart-preview').innerHTML = '';
    try {
      const material = $('#smart-source').value === 'paste' ? $('#smart-paste').value : fullText;
      if (!material.trim()) throw Error('请先粘贴或准备正文');
      const cleanNoise = $('#smart-clean').checked;
      const mergeShort = $('#smart-merge').checked;
      const minChars = Math.max(100, Math.min(5000, Number($('#smart-min').value) || 400));
      const suggestLongChapterBreaks = $('#smart-breaks').checked;
      let llmLines;
      if ($('#smart-llm').checked) {
        if (!(hasLlmKey(llm) || llm.provider === 'ollama' || llm.provider === 'lmstudio')) throw Error('尚未配置大模型密钥，请先打开“大模型设置”');
        const prepared = prepareSource(material, {cleanNoise});
        controller = new AbortController();
        $('#smart-cancel').hidden = false;
        status('正在请求大模型识别标题…');
        const reply = await llmChapterLines({
          text: prepared.cleanedText,
          config: llmConfig(llm),
          signal: controller.signal,
          onProgress: ({done, total}) => status(`正在请求大模型 ${done}/${total} 段…`)
        });
        llmLines = reply.lines;
        status(`大模型给出 ${llmLines.length} 个标题行，正在用离线规则验证…`);
      } else {
        status('正在分析…');
      }
      result = smartSplit(material, {cleanNoise, mergeShort, minChars, suggestLongChapterBreaks, llmLines});
      renderPreview(result, source, {esc, status, toast, commit, getDraft, close: () => $('#dialog').close()});
      document.querySelector('#smart-preview')?.scrollIntoView({block: 'nearest'});
    } catch (error) {
      status(error.message);
    } finally {
      controller = null;
      const cancel = $('#smart-cancel');
      if (cancel) cancel.hidden = true;
      if (button.isConnected) button.disabled = false;
    }
  };
}

function renderPreview(result, source, {esc, status, toast, commit, getDraft, close}) {
  const preview = $('#smart-preview');
  if (!preview) return;
  const chapters = result.chapters;
  const safe = result.integrity?.ok !== false;
  const listed = chapters.slice(0, 150);
  const noiseExamples = result.noise.entries.slice(0, 12);
  status(`分析完成：${chapters.length} 章 · ${result.method}`);
  preview.innerHTML = `<div class="smart-result">
    <div class="smart-result-head"><strong>${esc(result.method)}</strong><span>${chapters.length} 章 · ${chars(result.metrics.bodyCharacters)} 字</span></div>
    ${result.forum ? `<p class="smart-hint">识别结构：${esc(result.forum.summary)}。${result.forum.confidence === 'low' ? '证据较弱，请逐章核对。' : ''}</p>` : ''}
    <p class="smart-hint ${safe ? '' : 'smart-danger'}">${safe ? '正文覆盖核对通过：过滤与切分没有删改故事文字。' : '正文覆盖核对未通过，请勿直接应用，先导出原文备份。'}</p>
    <ol class="smart-chapter-list">${listed.map((chapter, index) => `<li><b>${String(index + 1).padStart(2, '0')}</b><span>${esc(chapter.title)}</span><small>${chars(chapter.body.length)} 字${chapter.pendingBreakpoints?.length ? ` · ${chapter.pendingBreakpoints.length} 个断点建议` : ''}</small></li>`).join('')}</ol>
    ${chapters.length > listed.length ? `<p class="smart-hint">其余 ${chapters.length - listed.length} 章未逐条列出，应用后可在左侧目录查看。</p>` : ''}
    <details ${noiseExamples.length ? '' : 'hidden'}><summary>站点杂讯：${result.noise.entries.length} 行 · ${chars(result.noise.removedCharacters)} 字</summary>
      <ul class="smart-noise-list">${noiseExamples.map(entry => `<li><span>第 ${entry.line} 行 · ${esc(entry.label)}</span><code>${esc(entry.text)}</code></li>`).join('')}</ul>
      ${result.noise.suspects.length ? `<p class="smart-hint">另有 ${result.noise.suspects.length} 行像正文却含站点关键词，已保留待你核对。</p>` : ''}
    </details>
    <details ${result.diagnostics.length ? '' : 'hidden'}><summary>体检提示：${result.diagnostics.length} 条</summary>
      <ul class="smart-diagnostic-list">${result.diagnostics.slice(0, 20).map(item => `<li>${esc(item.message || item.code)}</li>`).join('')}</ul>
    </details>
    <p class="smart-hint">应用后会在草稿箱保留「智能分章前备份」，已标记的断点会尽量迁移到新章节。</p>
    <div class="actions"><button class="primary" id="smart-apply" ${safe ? '' : 'disabled'}>应用并保留备份</button><button id="smart-rerun">重新分析</button><button data-action="close">取消</button></div>
  </div>`;
  $('#smart-rerun').onclick = () => $('#smart-run').click();
  $('#smart-apply').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (typeof commit !== 'function') throw Error('当前页面无法保存草稿，请刷新后重试');
      if (typeof getDraft === 'function' && getDraft() !== source) throw Error('草稿已切换，请关闭后重新打开一键分章');
      const {next, backup} = applySmartSplit(source, result);
      await commit(next, 0, backup);
      close();
      toast(`已按 ${next.chapters.length} 章重新分章，原稿已备份到草稿箱`);
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  };
}
