import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChapterTitles, bookToText, bookToMarkdown, exportFilename, chineseNumberText} from '../src/book-export.js';

const book = {
  title: '雨夜',
  author: '某作者',
  intro: '一个短篇。',
  chapters: [
    {title: '第１章 开端', body: '正文一'},
    {title: '第 二 章 旧信', body: '正文二'},
    {title: '第03章 渡口', body: '正文三'},
    {title: '序章', body: '正文四'},
    {title: 'Chapter 5 Night', body: '正文五'},
    {title: '番外 · 后来', body: '正文六'}
  ]
};

test('中文数字生成覆盖个位、十位与零', () => {
  assert.equal(chineseNumberText(1), '一');
  assert.equal(chineseNumberText(10), '十');
  assert.equal(chineseNumberText(12), '十二');
  assert.equal(chineseNumberText(20), '二十');
  assert.equal(chineseNumberText(101), '一百零一');
  assert.equal(chineseNumberText(110), '一百一十');
  assert.equal(chineseNumberText(1001), '一千零一');
  assert.equal(chineseNumberText(10000), '10000');
});

test('统一章名只改编号前缀，后缀与无编号标题保持原样', () => {
  const {chapters, changes, skipped} = normalizeChapterTitles(book.chapters, {style: 'chinese'});
  assert.equal(chapters[0].title, '第一章 开端');
  assert.equal(chapters[1].title, '第二章 旧信');
  assert.equal(chapters[2].title, '第三章 渡口');
  assert.equal(chapters[3].title, '序章');
  assert.equal(chapters[4].title, 'Chapter 5 Night');
  assert.equal(chapters[5].title, '番外 · 后来');
  assert.equal(changes.length, 3);
  assert.equal(skipped, 1);
  assert.deepEqual(changes[0], {index: 0, before: '第１章 开端', after: '第一章 开端'});
});

test('阿拉伯数字格式统一为“第N章”', () => {
  const {chapters} = normalizeChapterTitles([{title: '第十章 风', body: 'x'}, {title: '第 007 章 雨', body: 'y'}], {style: 'arabic'});
  assert.equal(chapters[0].title, '第10章 风');
  assert.equal(chapters[1].title, '第7章 雨');
});

test('无效格式被拒绝，超长标题被截断到 100 字', () => {
  assert.throws(() => normalizeChapterTitles(book.chapters, {style: 'roman'}), /章名格式无效/);
  const long = '第1章 ' + '长'.repeat(120);
  assert.equal(normalizeChapterTitles([{title: long, body: 'x'}]).chapters[0].title.length, 100);
});

test('TXT 导出包含书名、作者与章节正文', () => {
  const text = bookToText(book);
  assert.match(text, /^《雨夜》/);
  assert.match(text, /作者：某作者/);
  assert.match(text, /一个短篇。/);
  assert.match(text, /第１章 开端\n\n正文一/);
  assert.ok(text.endsWith('\n'));

  const bodyOnly = bookToText(book, {includeHeader: false});
  assert.equal(bodyOnly.startsWith('第１章 开端'), true);
  assert.equal(bodyOnly.includes('作者：'), false);
});

test('Markdown 导出用二级标题表示章节', () => {
  const md = bookToMarkdown(book);
  assert.match(md, /^# 雨夜/);
  assert.match(md, /\n## 第１章 开端\n\n正文一/);
  assert.match(md, /\n## 番外 · 后来/);
});

test('导出文件名去掉不安全字符并保留扩展名', () => {
  assert.equal(exportFilename({title: '雨夜/上：下'}, 'txt'), '雨夜_上_下.txt');
  assert.equal(exportFilename({id: 'story-1'}, 'md'), 'story-1.md');
});
