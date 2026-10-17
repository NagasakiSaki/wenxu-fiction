// 抓取文本的排版清洗：零宽字符、不换行空格与软连字符肉眼不可见，
// 却会破坏断点偏移、行号比对和搜索结果。只处理这些字符，不动标点与换行。
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const NO_BREAK_SPACE = /\u00A0/g;
const SOFT_HYPHEN = /\u00AD/g;

/**
 * @returns {{text:string, changed:boolean, removed:{zeroWidth:number, noBreakSpace:number, softHyphen:number}}}
 */
export function tidyText(input, {zeroWidth = true, noBreakSpace = true, softHyphen = true} = {}) {
  let text = String(input ?? '');
  const removed = {zeroWidth: 0, noBreakSpace: 0, softHyphen: 0};
  if (zeroWidth) {
    removed.zeroWidth = (text.match(ZERO_WIDTH) || []).length;
    text = text.replace(ZERO_WIDTH, '');
  }
  if (noBreakSpace) {
    removed.noBreakSpace = (text.match(NO_BREAK_SPACE) || []).length;
    text = text.replace(NO_BREAK_SPACE, ' ');
  }
  if (softHyphen) {
    removed.softHyphen = (text.match(SOFT_HYPHEN) || []).length;
    text = text.replace(SOFT_HYPHEN, '');
  }
  const changed = removed.zeroWidth + removed.noBreakSpace + removed.softHyphen > 0;
  return {text, changed, removed};
}

/** 面向界面的中文摘要；没有任何改动时返回空字符串。 */
export function tidySummary(removed) {
  if (!removed) return '';
  const parts = [];
  if (removed.zeroWidth) parts.push(`${removed.zeroWidth} 个零宽字符`);
  if (removed.noBreakSpace) parts.push(`${removed.noBreakSpace} 个不换行空格`);
  if (removed.softHyphen) parts.push(`${removed.softHyphen} 个软连字符`);
  return parts.join('、');
}

/** 正文完全相同的章节（重复抓取/重复楼层），只报告不自动删除。 */
export function duplicateChapterGroups(chapters) {
  const seen = new Map();
  for (const [index, chapter] of chapters.entries()) {
    const body = String(chapter.body || '').replace(/\s/g, '');
    if (body.length < 40) continue; // 极短章节重复可能是正常的排版
    if (!seen.has(body)) seen.set(body, []);
    seen.get(body).push(index);
  }
  return [...seen.values()].filter(indexes => indexes.length > 1).map(indexes => ({indexes, bodyLength: String(chapters[indexes[0]].body).length}));
}
