// 导出与章名整理：把作品变成可带走的纯文本，并把“第１２章 / 第 一 章 / 第01章”
// 统一成同一种写法。只处理编号前缀，章名后缀保持原样。
import {numberedTitle} from './chapter-edit.js';

const DIGITS = '零一二三四五六七八九';

function chineseNumberText(value) {
  if (!Number.isInteger(value) || value < 0) return String(value);
  if (value === 0) return '零';
  if (value >= 10000) return String(value);
  const units = ['', '十', '百', '千'];
  let result = '';
  let zero = false;
  for (let place = 3; place >= 0; place--) {
    const digit = Math.floor(value / 10 ** place) % 10;
    if (digit) {
      if (zero && result) result += '零';
      result += DIGITS[digit] + units[place];
      zero = false;
    } else if (result) {
      zero = true;
    }
  }
  return result.replace(/^一十/, '十');
}

export {chineseNumberText};

/**
 * 统一章名编号写法。只改“第…章/节/回…”这类前缀，后缀与无编号标题保持原样，
 * 英文 Chapter 也保持原样，避免把作者的双语标题弄乱。
 * @returns {{chapters: Array, changes: Array<{index:number,before:string,after:string}>, skipped:number}}
 */
export function normalizeChapterTitles(chapters, {style = 'chinese'} = {}) {
  if (!['chinese', 'arabic'].includes(style)) throw Error('章名格式无效');
  const changes = [];
  let skipped = 0;
  const next = chapters.map((chapter, index) => {
    const parsed = numberedTitle(chapter.title);
    if (!parsed) return chapter;
    if (!String(parsed.family).startsWith('cn:')) {
      skipped++;
      return chapter;
    }
    const unitMatch = chapter.title.match(/^第\s*[0-9０-９零〇一二两三四五六七八九十百千万]+\s*([章节回集幕话篇])/);
    const unit = unitMatch?.[1] || '章';
    const numberText = style === 'arabic' ? String(parsed.number) : chineseNumberText(parsed.number);
    const after = `第${numberText}${unit}${parsed.suffix}`.slice(0, 100);
    if (after !== chapter.title) changes.push({index, before: chapter.title, after});
    return {...chapter, title: after};
  });
  return {chapters: next, changes, skipped};
}

/** 纯文本：书名、作者与简介可选，章节以标题 + 空行分隔。 */
export function bookToText(book, {includeHeader = true} = {}) {
  const parts = [];
  if (includeHeader) {
    parts.push(`《${book.title || '未命名作品'}》`);
    if (book.author) parts.push(`作者：${book.author}`);
    if (book.intro) parts.push('', book.intro);
    parts.push('');
  }
  for (const chapter of book.chapters || []) parts.push(`${chapter.title}\n\n${chapter.body}`);
  return `${parts.join('\n').trim()}\n`;
}

/** Markdown：一级标题是书名，二级标题是章节。 */
export function bookToMarkdown(book) {
  const parts = [`# ${book.title || '未命名作品'}`];
  if (book.author) parts.push('', `作者：${book.author}`);
  if (book.intro) parts.push('', book.intro);
  for (const chapter of book.chapters || []) parts.push('', `## ${chapter.title}`, '', chapter.body);
  return `${parts.join('\n').trim()}\n`;
}

export function exportFilename(book, extension) {
  const base = String(book?.title || book?.id || 'wenxu').replace(/[^\w\u4e00-\u9fff.\-]/g, '_').slice(0, 80);
  return `${base}.${extension}`;
}
