import {inspectSerialPosts,serialNoise,serialPlan,withSerialVolumes} from './forum-serial.js';
// 一键智能分章：把整篇原文交给同一套可解释规则处理。
// 顺序是「过滤站点杂讯 → 识别标题（离线规律 / 大模型候选）→ 结构引擎验证覆盖 → 生成章节」，
// 大模型与规律识别都只提出分界行，任何正文都由引擎按原文字符还原，避免改写作者的文字。
import {analyseChapters} from './chapter-analysis.js';
import {cleanLines, detectNoise} from './forum-noise.js';
import {describeForumTemplate, detectForumHeadings} from './forum-headings.js';
import {suggestBreaks} from './break-suggestions.js';
import {MAX_BOOK_CHARACTERS} from './limits.js';
import {tidyText} from './text-tidy.js';

const compact = text => String(text).replace(/\s/g, '').length;

export function normalizeText(input) {
  return String(input ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/**
 * 统一换行并（可选）过滤站点杂讯。界面与大模型行号都基于这份清洗结果，
 * 保证“识别出的行号”和“真正切分的行”是同一套坐标。
 */
export function prepareSource(input, {cleanNoise = true, tidy = true, forumSerial = true} = {}) {
  const raw = normalizeText(input);
  const tidied = tidy ? tidyText(raw) : {text: raw, changed: false, removed: {zeroWidth: 0, noBreakSpace: 0, softHyphen: 0}};
  const text = tidied.text;
  const lines = text.split('\n');
  const inspection=forumSerial?inspectSerialPosts(lines,raw.split('\n')):{recognized:false};
  const noise = cleanNoise
    ? inspection.recognized?serialNoise(lines,inspection):detectNoise(lines)
    : {remove: new Set(), entries: [], suspects: [], counts: {}, removedCharacters: 0};
  const cleanedLines = cleanNoise ? cleanLines(lines, noise) : lines;
  const sourceLines=lines.flatMap((_,i)=>!noise.remove.has(i)?[i+1]:[]);
  const serial=inspection.recognized?{recognized:true,posts:inspection.posts,sourceLines,...serialPlan(cleanedLines,inspection.posts,sourceLines)}:null;
  return {text, lines, cleanedLines, cleanedText: cleanedLines.join('\n'), noise, tidy: tidied,serial};
}

/** 草稿各章正文拼成的整篇文本；与断点偏移使用同一套规则。 */
export function draftText(chapters) {
  return chapters.map(chapter => chapter.body).join('\n');
}

/** 计算各章正文在整篇文本中的起止位置。 */
export function chapterRanges(chapters) {
  let cursor = 0;
  return chapters.map(chapter => {
    const range = {start: cursor, end: cursor + chapter.body.length};
    cursor = chapter.body.length + 1 + cursor;
    return range;
  });
}

/**
 * 把旧章节里的手动断点迁移到重新分章的章节上。
 * 断点位于新章节边界或代理对内部时丢弃，其余保持字符位置。
 */
export function rebaseBreakpoints(sourceChapters, targetChapters) {
  const source = chapterRanges(sourceChapters);
  const target = chapterRanges(targetChapters);
  const global = new Set();
  sourceChapters.forEach((chapter, index) => {
    for (const point of chapter.pendingBreakpoints || []) {
      if (!Number.isInteger(point) || point <= 0 || point >= chapter.body.length) continue;
      global.add(source[index].start + point);
    }
  });
  const mapped = targetChapters.map(() => []);
  for (const offset of global) {
    const index = target.findIndex(range => offset > range.start && offset < range.end);
    if (index < 0) continue;
    const body = targetChapters[index].body;
    const local = offset - target[index].start;
    const before = body[local - 1] || '';
    const after = body[local] || '';
    if (lowSurrogate(after) && highSurrogate(before)) continue; // 不落在 Emoji 等代理对内部
    mapped[index].push(local);
  }
  return targetChapters.map((chapter, index) => {
    const points = mapped[index].length ? mapped[index].sort((a, b) => a - b).slice(0, 999) : null;
    if (!points) {
      const {pendingBreakpoints, ...rest} = chapter;
      return rest;
    }
    return {...chapter, pendingBreakpoints: points};
  });
}

const highSurrogate = char => /[\uD800-\uDBFF]/.test(char);
const lowSurrogate = char => /[\uDC00-\uDFFF]/.test(char);

/**
 * 合并没有正文、或明显短于本书中位篇幅的碎章。
 * 短章超过一半时判定标题结构可疑，放弃合并而不是把整篇挤成一章。
 */
export function mergeShortChapters(chapters, {minChars = 400} = {}) {
  if (chapters.length < 2) return {chapters, merged: 0, skipped: true};
  const short = chapters.filter(chapter => compact(chapter.body) < minChars).length;
  if (short > chapters.length / 2) return {chapters, merged: 0, skipped: true};
  const merged = [];
  let count = 0;
  for (const chapter of chapters) {
    const previous = merged[merged.length - 1];
    const fits = previous
      && compact(chapter.body) < minChars
      && (previous.volume || '') === (chapter.volume || '')
      && compact(previous.body) < minChars * 6;
    if (!fits) {
      merged.push({...chapter});
      continue;
    }
    merged[merged.length - 1] = {
      ...previous,
      body: `${previous.body}\n\n${chapter.body}`.trim(),
      sourceEndLine: chapter.sourceEndLine ?? previous.sourceEndLine
    };
    count++;
  }
  return {chapters: merged, merged: count, skipped: false};
}

/** 编号体检：只报告异常，不改动正文或章节顺序。 */
export function orderDiagnostics(chapters) {
  const notes = [];
  const numbered = chapters.map((chapter, index) => {
    const match = String(chapter.title || '').replace(/^[\s【〔\[（(]+/, '').match(/^第\s*([0-9０-９零〇一二两三四五六七八九十百千万]+)\s*[章节回集幕话篇]/u);
    if (!match) return null;
    const digits = match[1].normalize('NFKC');
    const count = /^\d+$/.test(digits) ? Number(digits) : null;
    return count === null ? null : {index, number: count};
  }).filter(Boolean);
  if (numbered.length < 2) return notes;
  if (numbered.every(item => item.number === numbered[0].number)) {
    notes.push({code: 'repeated-number', level: '警告', message: '整篇章节编号相同，可能是重复抓取或标题误判，请核对预览。'});
    return notes;
  }
  const descending = numbered.slice(1).filter((item, index) => item.number < numbered[index].number).length;
  if (descending > numbered.length * 0.3) notes.push({code: 'descending-number', level: '警告', message: `有 ${descending} 处编号比上一章更小，可能抓取顺序颠倒；可对照原文核对后再应用。`});
  const gaps = numbered.slice(1).filter((item, index) => item.number - numbered[index].number > 1).length;
  if (gaps) notes.push({code: 'number-gap', level: '提示', message: `有 ${gaps} 处章节编号跳号，可能是缺章，也可能只是抓取时漏了楼层。`});
  return notes;
}

function biggestChapterShare(chapters) {
  const total = chapters.reduce((sum, chapter) => sum + compact(chapter.body), 0);
  if (!total) return 1;
  return Math.max(...chapters.map(chapter => compact(chapter.body))) / total;
}

function validateBoundaryLines(lines, sourceLines) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const unique = [...new Set(lines)].sort((a, b) => a - b);
  if (unique.length > 1000) throw Error('识别到的分界超过1000个，请拆分文件后分章');
  for (const line of unique) {
    if (!Number.isInteger(line) || line < 1 || line > sourceLines.length) throw Error(`分界行 ${line} 超出文本范围`);
    const text = sourceLines[line - 1];
    if (!text || !text.trim()) throw Error(`第 ${line} 行是空行，不能作标题`);
    if (text.trim().length > 100) throw Error(`第 ${line} 行超过100字，不能作标题`);
  }
  return unique;
}

/**
 * 整篇智能分章。
 * @param {string} input 原始文本
 * @param {{cleanNoise?:boolean, mergeShort?:boolean, minChars?:number, suggestLongChapterBreaks?:boolean,
 *          breakTarget?:number, profile?:object, llmLines?:number[], fallbackTitle?:string}} options
 */
export function smartSplit(input, {
  cleanNoise = true,
  tidy = true,
  forumSerial = true,
  mergeShort = true,
  minChars = 400,
  suggestLongChapterBreaks = false,
  breakTarget = 3000,
  profile,
  positiveLines,
  negativeLines = [],
  llmLines,
  fallbackTitle = '序言'
} = {}) {
  const {text, lines, cleanedLines: cleaned, cleanedText, noise, tidy: tidied,serial} = prepareSource(input, {cleanNoise, tidy,forumSerial});
  if (!compact(text)) throw Error('没有可分析的正文');
  if (text.length > MAX_BOOK_CHARACTERS) throw Error('单部作品最多 200 万字符，请拆分文件后分章');

  if (!compact(cleanedText)) throw Error('过滤站点杂讯后没有剩余正文，请关闭杂讯过滤后重试');

  let method = '';
  let forum = null;
  const archiveLines=serial?.arcs.map(a=>a.line)||[];
  const serialAutomatic=!!serial?.recognized&&!profile&&positiveLines===undefined;
  let analysis = serialAutomatic?null:analyseChapters(cleanedText, {fallbackTitle, profile, positiveLines, negativeLines,archiveLines});
  method = analysis?.method||'';

  // 大模型候选优先；否则在引擎只得到整篇、或某一章明显吞掉全文时，补充规律标题识别。
  let boundaryLines = null;
  if(serialAutomatic){
    const excluded=new Set(serial.roles.filter(r=>['ending','commentary','repeat','arc'].includes(r.kind)).map(r=>r.line));
    boundaryLines=llmLines?.length?validateBoundaryLines(llmLines,cleaned).filter(n=>!excluded.has(n)):serial.headings;
    analysis=analyseChapters(cleanedText,{fallbackTitle,boundaryLines,archiveLines});
    method=llmLines?.length?'大模型 / 论坛连载整理':'论坛连载整理';
  } else if (llmLines?.length) {
    boundaryLines = validateBoundaryLines(llmLines, cleaned);
    method = '大模型分章';
  } else {
    const dominant = analysis.chapters.length <= 1 || (text.length >= 4000 && biggestChapterShare(analysis.chapters) > 0.5);
    if (dominant&&!serial?.recognized) {
      forum = detectForumHeadings(cleaned);
      const found = forum.headings.map(heading => heading.line);
      const existing = analysis.boundaryLines || [];
      const merged = [...new Set([...existing, ...found])].sort((a, b) => a - b);
      if (found.length >= 2 && merged.length > existing.length) {
        boundaryLines = validateBoundaryLines(merged, cleaned);
        method = '规律标题识别';
      }
    }
  }

  if (boundaryLines?.length&&!serialAutomatic) {
    analysis = analyseChapters(cleanedText, {fallbackTitle, profile, positiveLines, negativeLines, boundaryLines,archiveLines});
  }

  let chapters = withSerialVolumes(analysis.chapters,serial).map(chapter => ({
    title: chapter.title,
    body: chapter.body,
    ...(chapter.volume ? {volume: chapter.volume} : {}),
    ...(chapter.sections?.length ? {sections: chapter.sections} : {}),
    ...(chapter.sourceStartLine ? {sourceStartLine: chapter.sourceStartLine} : {})
  }));

  let mergeReport = {merged: 0, skipped: true};
  if (mergeShort&&!serial?.recognized) {
    mergeReport = mergeShortChapters(chapters, {minChars});
    chapters = mergeReport.chapters;
  }

  let suggested = 0;
  if (suggestLongChapterBreaks) {
    chapters = chapters.map(chapter => {
      if (compact(chapter.body) < breakTarget * 1.5) return chapter;
      const {points} = suggestBreaks(chapter.body, breakTarget, {strategy: 'scene'});
      if (!points.length) return chapter;
      suggested += points.length;
      return {...chapter, pendingBreakpoints: points.map(point => point.offset).slice(0, 999)};
    });
  }

  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.body.length, 0);
  if (!chapters.length) throw Error('没有识别出可阅读的正文，请检查文件内容');
  if (chapters.length > 1000) throw Error('识别出超过1000章，请合并碎章或拆分文件');
  if (totalCharacters > MAX_BOOK_CHARACTERS) throw Error('分章后超过 200 万字符上限');

  const resets=new Set((serial?.roles||[]).filter(r=>r.kind==='start'&&r.volume&&r.number<=1).map(r=>r.line));
  const diagnostics = [...analysis.diagnostics.filter(d=>!(resets.has(d.line)&&['sequence-gap','repeated-number'].includes(d.code))), ...orderDiagnostics(chapters)];
  if (mergeReport.merged) diagnostics.push({code: 'merged-short', level: '提示', message: `已把 ${mergeReport.merged} 个碎章并入前一章；正文未删减。`});
  if (mergeReport.skipped && mergeShort&&!serial?.recognized) diagnostics.push({code: 'merge-skipped', level: '提示', message: '短章超过一半，可能标题结构可疑，未自动合并，请在预览里核对。'});

  return {
    format: 'wenxu-smart-split-v1',
    serial,
    chapters,
    cleanedText,
    method,
    tidy: {changed: tidied.changed, removed: tidied.removed},
    boundaryLines: boundaryLines || analysis.boundaryLines || [],
    noise,
    forum: forum ? {...forum, summary: describeForumTemplate(forum.template)} : null,
    diagnostics,
    integrity: analysis.integrity,
    metrics: {
      sourceCharacters: text.length,
      bodyCharacters: totalCharacters,
      chapters: chapters.length,
      removedLines: noise.entries.length,
      removedCharacters: noise.removedCharacters,
      suspectedLines: noise.suspects.length,
      invisibleCharacters: tidied.removed.zeroWidth + tidied.removed.noBreakSpace + tidied.removed.softHyphen,
      mergedChapters: mergeReport.merged,
      suggestedBreakpoints: suggested,
      candidateCount: analysis.metrics?.candidateCount ?? 0
    }
  };
}

/** 把智能分章结果应用到草稿，先备份当前章节。 */
export function applySmartSplit(draft, result, {backupKey = crypto.randomUUID(), label = '智能分章前备份'} = {}) {
  if (!result?.chapters?.length) throw Error('没有可应用的分章结果');
  const chapters = rebaseBreakpoints(draft.chapters, result.chapters);
  return {
    next: {...draft, chapters},
    backup: {
      ...structuredClone(draft),
      draftKey: backupKey,
      title: `${draft.title || '未命名作品'} · ${label}`.slice(0, 100)
    }
  };
}
