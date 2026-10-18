// 分界校对界面：原文逐行列表，点击增删分界，应用前重新核对正文覆盖。
// 渲染在调用方给定的容器里，避免在已打开的弹窗上再开一个弹窗。
import {planFromSplit, windowRows, setHeading, buildReview} from './boundary-review.js';

const $ = selector => document.querySelector(selector);

export function boundaryReviewMarkup() {
  return `<div class="review-dialog"><span class="eyebrow">BOUNDARY REVIEW</span><h2>在原文中校对分界</h2>
  <p>点击任意一行设为分界，再点一次取消。行号是过滤杂讯后原文的行号，正文不会被改写。</p>
  <div class="review-toolbar">
    <button id="review-prev">↑ 上一个分界</button>
    <button id="review-next">↓ 下一个分界</button>
    <label class="review-jump">跳到行 <input id="review-jump" type="number" min="1" step="1" value="1"></label>
    <button id="review-examples">用当前分界作示例重扫</button>
    <button id="review-back">返回预览</button>
  </div>
  <span id="review-position" class="review-position" role="status"></span>
  <div class="review-list" id="review-list" role="list"></div>
  <p class="review-summary" id="review-summary" role="status">正在核对正文覆盖…</p>
  <div class="actions"><button class="primary" id="review-apply" disabled>按当前分界重新分章</button><button data-action="close">取消</button></div></div>`;
}

/** 在 host 元素里打开校对；onBack 返回预览，onExamples 用分界作标题正例重扫。 */
export function bindBoundaryReview({result, host, esc, toast, onApply, onBack, onExamples,focusLine}) {
  const plan = planFromSplit(result);
  const state = {text: plan.text, headings: plan.headings, center: focusLine || plan.headings[0] || 1, chapters: null, timer: null};
  host.innerHTML = boundaryReviewMarkup();

  function totalLines() {
    return state.text.split('\n').length;
  }

  function renderWindow() {
    const {rows, start, end, total} = windowRows(state.text, {centerLine: state.center});
    const headingSet = new Set(state.headings);
    const list = $('#review-list');
    list.innerHTML = rows.map(row => {
      const heading = headingSet.has(row.line);
      const preview = row.text.slice(0, 160);
      return `<button type="button" role="listitem" class="review-row${heading ? ' is-heading' : ''}" data-line="${row.line}"><span class="review-line-no">${row.line}</span><span class="review-line-text">${preview ? esc(preview) : '<em class="review-empty">空行</em>'}</span><span class="review-mark">${heading ? '分界' : ''}</span></button>`;
    }).join('');
    $('#review-position').textContent = `第 ${start}–${end} 行 / 共 ${total.toLocaleString()} 行 · ${state.headings.length} 个分界${result.serial?.sourceLines?.[state.center-1]?` · 当前对应导入原文第 ${result.serial.sourceLines[state.center-1]} 行`:''}`;
    const jump = $('#review-jump');
    if (jump) jump.value = state.center;
    const active = list.querySelector(`[data-line="${state.center}"]`)||list.querySelector('.is-heading');
    if (active) active.scrollIntoView({block: 'center'});
    else list.scrollTop = 0;
  }

  function recompute() {
    const summary = $('#review-summary');
    const button = $('#review-apply');
    if (summary) summary.textContent = '正在核对正文覆盖…';
    if (button) button.disabled = true;
    state.chapters = null;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.headings.length) {
        summary.textContent = '当前没有分界，整篇会作为一个章节应用。';
        return;
      }
      try {
        const review = buildReview(state.text, state.headings,{serial:result.serial});
        state.chapters = review.chapters;
        const diagnostics = review.diagnostics.length ? ` · ${review.diagnostics.length} 条提示` : '';
        summary.textContent = `${review.chapters.length} 章 · 正文覆盖核对${review.integrity.ok ? '通过' : '未通过'}${diagnostics}`;
        if (button) {
          button.disabled = !review.integrity.ok;
          button.textContent = review.integrity.ok ? '按当前分界重新分章' : '覆盖核对未通过，不能应用';
        }
      } catch (error) {
        summary.textContent = error.message;
      }
    }, 200);
  }

  renderWindow();
  recompute();

  $('#review-list').addEventListener('click', event => {
    const row = event.target.closest('.review-row');
    if (!row) return;
    const line = Number(row.dataset.line);
    try {
      const heading = state.headings.includes(line);
      state.headings = setHeading(state.text, state.headings, line, !heading);
      state.center = Math.max(1, Math.min(line, totalLines()));
      renderWindow();
      recompute();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#review-prev').onclick = () => {
    const previous = [...state.headings].reverse().find(line => line < state.center);
    state.center = previous ?? state.headings[0] ?? 1;
    renderWindow();
  };
  $('#review-next').onclick = () => {
    state.center = state.headings.find(line => line > state.center) ?? state.center;
    renderWindow();
  };
  $('#review-jump').onchange = event => {
    state.center = Math.max(1, Math.min(Number(event.target.value) || 1, totalLines()));
    renderWindow();
  };
  $('#review-back').onclick = () => {
    clearTimeout(state.timer);
    onBack();
  };
  $('#review-examples').onclick = () => {
    clearTimeout(state.timer);
    if (state.headings.length < 2) return toast('请先标记 2–12 个标题行作为示例');
    if (state.headings.length > 12) return toast('示例最多 12 个，请取消多余的分界');
    if (typeof onExamples !== 'function') return toast('当前页面不支持示例重扫');
    onExamples(state.headings);
  };
  $('#review-apply').onclick = async event => {
    if (!state.chapters) return toast('还没有完成核对');
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await onApply(state.chapters);
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  };
}
