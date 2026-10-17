import test from 'node:test';
import assert from 'node:assert/strict';
import {tidyText, tidySummary, duplicateChapterGroups} from '../src/text-tidy.js';
import {prepareSource, smartSplit} from '../src/smart-split.js';

test('零宽字符、不换行空格与软连字符被清理并计数', () => {
  const input = '第一行\u200B有零宽\u00A0空格\r\n第二行\u00AD软连字符';
  const result = tidyText(input);
  assert.equal(result.text.includes('\u200B'), false);
  assert.equal(result.text.includes('\u00A0'), false);
  assert.equal(result.text.includes('\u00AD'), false);
  assert.equal(result.text, '第一行有零宽 空格\r\n第二行软连字符');
  assert.deepEqual(result.removed, {zeroWidth: 1, noBreakSpace: 1, softHyphen: 1});
  assert.equal(result.changed, true);
  assert.match(tidySummary(result.removed), /零宽字符/);
});

test('没有不可见字符时保持原样', () => {
  const result = tidyText('普通正文，含标点与换行\n第二行');
  assert.equal(result.changed, false);
  assert.equal(tidySummary(result.removed), '');
});

test('清洗发生在分章之前，正文逐字保留可见字符', () => {
  const source = '1、雨夜\u200B\n' + '雨点敲在瓦上，他抬头看了一眼远处的灯，没有说话。'.repeat(12) + '\n2、旧信\u200B\n' + '天亮了，他还在等那封信。'.repeat(12);
  const prepared = prepareSource(source, {cleanNoise: true});
  assert.equal(prepared.text.includes('\u200B'), false);
  assert.equal(prepared.tidy.removed.zeroWidth, 2);
  const result = smartSplit(source, {minChars: 100});
  assert.equal(result.tidy.removed.zeroWidth, 2);
  assert.equal(result.metrics.invisibleCharacters, 2);
  assert.equal(result.cleanedText.includes('\u200B'), false);
  assert.ok(result.integrity.ok);
});

test('重复正文的章节会被分组，短章不参与', () => {
  const body = '完全相同的一段正文。'.repeat(8);
  const groups = duplicateChapterGroups([
    {title: '一', body},
    {title: '二', body: '短'},
    {title: '三', body},
    {title: '四', body: '另一段。'.repeat(20)}
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].indexes, [0, 2]);
});
