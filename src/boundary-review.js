import {withSerialVolumes} from './forum-serial.js';
// 分界校对：把一键分章的结果放回清洗后的原文，让作者逐行增删分界。
// 模型只做窗口与校验，真正的章节切分仍由结构引擎完成并核对覆盖。
import {analyseChapters} from './chapter-analysis.js';

export const REVIEW_WINDOW = 240;

export function planFromSplit(result) {
  if (!result?.chapters?.length) throw Error('没有可校对的分章结果');
  if (typeof result.cleanedText !== 'string' || !result.cleanedText) throw Error('缺少清洗后的原文，无法校对分界');
  return {
    text: result.cleanedText,
    headings: [...new Set(result.boundaryLines || [])].map(Number).filter(Number.isInteger).sort((a, b) => a - b)
  };
}

/** 取以某行为中心的窗口；行号始终是全文 1 起始行号。 */
export function windowRows(text, {centerLine = 1, size = REVIEW_WINDOW} = {}) {
  const lines = String(text).split('\n');
  const total = lines.length;
  const span = Math.max(20, Math.min(600, Math.floor(size)));
  const start = Math.max(1, Math.min(Math.floor(centerLine) - Math.floor(span / 2), total - span + 1));
  const end = Math.min(total, start + span - 1);
  const rows = [];
  for (let line = start; line <= end; line++) rows.push({line, text: lines[line - 1] ?? ''});
  return {rows, start, end, total};
}

const SEPARATOR = /^\s*(?:[-*_=·─━]\s*){3,}\s*$/;

/** 校验一行能否作为分界；返回 null 表示可以。 */
export function headingProblem(text, line) {
  const lines = String(text).split('\n');
  if (!Number.isInteger(line) || line < 1 || line > lines.length) return '分界行超出原文范围';
  const content = lines[line - 1] ?? '';
  if (!content.trim()) return '空行不能作为分界';
  if (content.trim().length > 100) return '超过 100 字的行不能作为标题';
  if (SEPARATOR.test(content)) return '分隔线不能作为标题';
  return null;
}

/** 增删分界，保持升序去重；非法行抛错而不是静默忽略。 */
export function setHeading(text, headings, line, enabled) {
  if (enabled) {
    const problem = headingProblem(text, line);
    if (problem) throw Error(problem);
    return [...new Set([...headings, line])].sort((a, b) => a - b);
  }
  return headings.filter(item => item !== line);
}

/** 用当前分界重新切分并核对覆盖。 */
export function buildReview(text, headings, {fallbackTitle = '序言',serial} = {}) {
  if (!headings.length) throw Error('请至少保留一个分界，或直接取消校对');
  if (headings.length > 1000) throw Error('分界超过1000个，请合并章节');
  const result = analyseChapters(text, {fallbackTitle, boundaryLines: headings,archiveLines:serial?.arcs?.filter(a=>!headings.includes(a.line)).map(a=>a.line)||[]});
  return {
    chapters: withSerialVolumes(result.chapters,serial),
    integrity: result.integrity,
    diagnostics: result.diagnostics.filter(item => item.code !== 'no-boundary'&&!(serial?.roles?.some(r=>r.kind==='start'&&r.line===item.line&&r.volume&&r.number<=1)&&['sequence-gap','repeated-number'].includes(item.code))),
    boundaryLines: result.boundaryLines
  };
}

/** 分界在窗口内的分布，用于“上一个/下一个分界”和进度提示。 */
export function headingBounds(headings, text) {
  const total = String(text).split('\n').length;
  return headings.filter(line => line >= 1 && line <= total);
}
