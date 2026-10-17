// 规律型标题识别：面向贴吧/转载站直接爬下来的长文。
// 这类文本的章节标题往往没有 Markdown 层级，也不一定与正文间有空行，
// 但同一种结构会反复出现、间隔较长，并且明显短于正文段落。这里只提出候选，
// 真正的分界仍由 chapter-analysis.js 在原文上验证覆盖；识别结果不直接改正文。
import {chineseNumber} from './chapter-numbers.js';

const NARRATIVE_END = /[。！？!?…”』」）)]$/;
const MAX_TITLE = 60;
// 去掉标题两侧的加粗、括号、引号等装饰，便于取出真实结构。
const LEADING_DECOR = /^[\s【〔\[（(「『"'“*_~—–-]+/;
const TRAILING_DECOR = /[\s】〕\]）)」』"'”]+$/;

function stripDecoration(line) {
  return line.replace(LEADING_DECOR, '').replace(TRAILING_DECOR, '').trim();
}

function cleanTitle(line) {
  return line.trim().slice(0, 100);
}

function parseBracketNumber(line) {
  const match = line.match(/^[【〔\[（(]\s*([0-9０-９零〇一二两三四五六七八九十百千万]{1,6})\s*[】〕\]）)]\s*(.*)$/u);
  if (!match) return null;
  return {number: chineseNumber(match[1]), rest: match[2]};
}

// 把【第12章】雨夜 这类“括号包住编号”的写法还原成 第12章 雨夜 再判断。
function unwrapPrefix(body) {
  return body.replace(/^[【〔\[（(]([^】〕\]）)]{1,24})[】〕\]）)]\s*/u, '$1 ').trim();
}

/**
 * 解析一行可能的标题，返回结构证据而不是布尔值。
 * @returns {{title:string, number:number|null, kind:'chapter'|'volume', signature:string, family:string}|null}
 */
export function parseForumHeading(rawLine) {
  const line = String(rawLine).trim();
  if (!line || line.length > MAX_TITLE) return null;
  if (NARRATIVE_END.test(line)) return null;
  const body = stripDecoration(line);
  if (!body) return null;
  const unwrapped = unwrapPrefix(body);

  const explicit = unwrapped.match(/^第\s*([0-9０-９零〇一二两三四五六七八九十百千万]+)\s*([章节回集幕话篇卷部])(?:[\s：:、.．,，·—–-]*(.*))?$/u);
  if (explicit) {
    const unit = explicit[2];
    return {
      title: cleanTitle(line),
      number: chineseNumber(explicit[1]),
      kind: ['卷', '部'].includes(unit) ? 'volume' : 'chapter',
      signature: `第#${unit}`,
      family: 'explicit'
    };
  }

  const english = unwrapped.match(/^(chapter|episode|part|section)\s*[.\-]?\s*([0-9]+|[ivxlcdm]+)(?:[\s：:.\-—]*(.*))?$/iu);
  if (english) {
    const word = english[1].toLowerCase();
    return {
      title: cleanTitle(line),
      number: /^\d+$/.test(english[2]) ? Number(english[2]) : null,
      kind: word === 'part' || word === 'section' ? 'volume' : 'chapter',
      signature: `${word} #`,
      family: 'english'
    };
  }

  // 【12】标题 / （12）标题 / [12] 标题：不同括号混用也归为同一结构。
  const bracketed = parseBracketNumber(line);
  if (bracketed) {
    return {title: cleanTitle(line), number: bracketed.number, kind: 'chapter', signature: '【#】', family: 'bracket-number'};
  }

  const numbered = unwrapped.match(/^([0-9０-９]{1,4}|[零〇一二两三四五六七八九十百]{1,4})\s*([、.．)）:：|｜])\s*(.*)$/u);
  if (numbered && numbered[3].trim()) {
    const separator = /[、]/u.test(numbered[2]) ? '、' : /[.．]/u.test(numbered[2]) ? '.' : /[)）]/u.test(numbered[2]) ? ')' : ':';
    return {title: cleanTitle(line), number: chineseNumber(numbered[1]), kind: 'chapter', signature: `#${separator}`, family: 'numbered'};
  }

  // 纯数字独立成行：部分爬取结果把章号单独放一行；也可能是楼号，因此证据等级最低。
  if (/^[0-9０-９]{1,4}$/u.test(body)) {
    return {title: cleanTitle(line), number: Number(body.normalize('NFKC')), kind: 'chapter', signature: '#', family: 'bare-number'};
  }

  // 整行被括号包住的短标题，如【夜雨】。标题各不相同，只能按“括号短行”这一形状聚类。
  if (/^[【〔\[（(「『].{1,24}[】〕\]）)」』]$/u.test(line)
    && !/^[【〔\[（(]\s*(?:图片|更新|公告|通知|视频|音频|置顶|精华|热帖|直播)/u.test(line)) {
    return {title: cleanTitle(line), number: null, kind: 'chapter', signature: '【标题】', family: 'bracket-title'};
  }

  return null;
}

function statistics(values) {
  if (!values.length) return {median: 0, mean: 0, variance: 0};
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {median, mean, variance};
}

function isIsolated(lines, index) {
  const before = index === 0 || !lines[index - 1].trim();
  const after = index + 1 >= lines.length || !lines[index + 1].trim();
  return before || after;
}

function ordinalRatio(items) {
  const numbered = items.filter(item => Number.isInteger(item.number));
  if (numbered.length < 2) return 1;
  let ascending = 0;
  for (let i = 1; i < numbered.length; i++) if (numbered[i].number > numbered[i - 1].number) ascending++;
  return ascending / (numbered.length - 1);
}

/**
 * 在清洗后的行数组里寻找反复出现、间隔较长的标题结构。
 * @param {string[]} lines 已去除站点杂讯的行
 * @param {{minCount?:number, minGap?:number}} options
 */
export function detectForumHeadings(lines, {minCount = 3, minGap = 300} = {}) {
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  const candidates = [];
  lines.forEach((line, index) => {
    const parsed = parseForumHeading(line);
    if (!parsed || parsed.kind === 'volume') return; // 卷仍由结构引擎归档，不单独成章
    candidates.push({...parsed, index, offset: offsets[index], isolated: isIsolated(lines, index)});
  });

  const groups = new Map();
  for (const item of candidates) {
    if (!groups.has(item.signature)) groups.set(item.signature, []);
    groups.get(item.signature).push(item);
  }

  const scored = [];
  for (const [signature, items] of groups) {
    const family = items[0].family;
    const floor = family === 'explicit' ? 2 : family === 'bracket-title' || family === 'bare-number' ? 4 : Math.max(3, minCount);
    if (items.length < floor) continue;
    const gaps = items.slice(1).map((item, i) => item.offset - items[i].offset);
    const {median, mean, variance} = statistics(gaps);
    const ascending = ordinalRatio(items);
    const isolated = items.filter(item => item.isolated).length / items.length;
    const distinctTitles = new Set(items.map(item => item.title)).size / items.length;
    if (median < minGap) continue;
    if (ascending < 0.6) continue;
    if (distinctTitles < 0.8) continue;
    const regularity = mean ? Math.max(0, 1 - Math.sqrt(variance) / mean) : 0;
    const score = items.length * 1.2 + ascending * items.length + isolated * 2 + distinctTitles * 2
      + regularity * 2 - (family === 'bare-number' ? 2 : 0);
    scored.push({signature, family, items, medianGap: Math.round(median), ascending, isolated, distinctTitles, regularity, score});
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) {
    return {headings: [], groups: [], template: null, confidence: 'none', metrics: {candidateLines: candidates.length, groupCount: groups.size, chosenCount: 0}};
  }

  // 明确章节词属于强证据：同族的“第N章 / 第N回”应当合在一起，而不是只保留其中一种写法。
  const familyGroups = best.family === 'explicit' || best.family === 'english'
    ? scored.filter(group => group.family === best.family)
    : [best];
  const chosen = familyGroups.flatMap(group => group.items).sort((a, b) => a.index - b.index);

  const headingList = chosen.map(item => {
    const evidence = [
      `同形结构重复 ${familyGroups.reduce((sum, group) => sum + group.items.length, 0)} 次`,
      `中位间隔 ${best.medianGap.toLocaleString()} 字`,
      best.ascending >= 0.8 ? '章号按顺序递增' : '章号大多递增',
      item.isolated ? '独立成行' : '紧邻正文'
    ];
    if (best.family === 'bare-number') evidence.push('纯数字成行，可能同时是楼号，请核对');
    return {
      line: item.index + 1,
      title: item.title,
      number: item.number,
      kind: 'chapter',
      family: best.family,
      evidence,
      confidence: best.family === 'bare-number' || best.family === 'bracket-title' ? '需核对' : best.family === 'explicit' || best.family === 'english' ? '明确标题' : '规律结构'
    };
  });

  return {
    headings: headingList,
    groups: scored.map(group => ({signature: group.signature, family: group.family, count: group.items.length, medianGap: group.medianGap, score: Number(group.score.toFixed(2))})),
    template: {signature: best.signature, family: best.family, count: chosen.length, medianGap: best.medianGap, regularity: Number(best.regularity.toFixed(2))},
    confidence: best.family === 'explicit' || best.family === 'english' ? 'high' : best.family === 'bracket-title' || best.family === 'bare-number' ? 'low' : 'medium',
    metrics: {candidateLines: candidates.length, groupCount: groups.size, chosenCount: chosen.length}
  };
}

/** 面向界面的结构说明，例如“第N章 · 重复 12 次 · 中位间隔 1,840 字”。 */
export function describeForumTemplate(template) {
  if (!template) return '未发现可复用的标题结构';
  const family = {
    explicit: '第N章',
    english: 'Chapter N',
    'bracket-number': '【N】',
    numbered: 'N、',
    'bare-number': '纯数字',
    'bracket-title': '【标题】'
  }[template.family] || template.signature;
  return `${family} · 重复 ${template.count} 次 · 中位间隔 ${template.medianGap.toLocaleString()} 字`;
}
