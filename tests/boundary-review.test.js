import test from 'node:test';
import assert from 'node:assert/strict';
import {planFromSplit, windowRows, headingProblem, setHeading, buildReview} from '../src/boundary-review.js';
import {smartSplit} from '../src/smart-split.js';

const paragraph = '雨点敲在瓦上，他抬头看了一眼远处的灯，没有说话。街上的人已经散尽。';
const source = Array.from({length: 4}, (_, index) => [`${index + 1}、雨夜之${index + 1}`, ...Array(10).fill(paragraph)].join('\n')).join('\n');

test('校对计划取自智能分章：清洗原文与分界行号', () => {
  const result = smartSplit(source, {minChars: 100});
  const plan = planFromSplit(result);
  assert.equal(plan.text, result.cleanedText);
  assert.deepEqual(plan.headings, [1, 12, 23, 34]);
  assert.deepEqual(planFromSplit({...result, boundaryLines: [12, 12, 1]}).headings, [1, 12]);
  assert.throws(() => planFromSplit({...result, cleanedText: ''}), /缺少清洗后的原文/);
  assert.throws(() => planFromSplit(null), /没有可校对的分章结果/);
});

test('窗口按中心行取上下文并夹在范围内', () => {
  const text = Array.from({length: 50}, (_, index) => `第${index + 1}行`).join('\n');
  const middle = windowRows(text, {centerLine: 25, size: 20});
  assert.equal(middle.rows.length, 20);
  assert.equal(middle.rows[0].line, 15);
  assert.equal(middle.rows.at(-1).line, 34);
  assert.equal(middle.total, 50);

  const first = windowRows(text, {centerLine: 1, size: 20});
  assert.equal(first.start, 1);
  const last = windowRows(text, {centerLine: 50, size: 20});
  assert.equal(last.end, 50);
  assert.equal(windowRows(text, {centerLine: 3, size: 20}).rows.length, 20);
});

test('分界行校验：空行、超长行、分隔线与越界都拒绝', () => {
  const text = ['第一行', '', '这是一段超过一百字的正文'.repeat(10), '---', '末行'].join('\n');
  assert.equal(headingProblem(text, 1), null);
  assert.match(headingProblem(text, 2), /空行/);
  assert.match(headingProblem(text, 3), /100/);
  assert.match(headingProblem(text, 4), /分隔线/);
  assert.match(headingProblem(text, 99), /超出/);
});

test('增删分界保持升序去重，非法行抛错', () => {
  const text = ['一', '二', '三', '四'].join('\n');
  assert.deepEqual(setHeading(text, [], 3, true), [3]);
  assert.deepEqual(setHeading(text, [3], 1, true), [1, 3]);
  assert.deepEqual(setHeading(text, [1, 3], 3, true), [1, 3]);
  assert.deepEqual(setHeading(text, [1, 3], 1, false), [3]);
  assert.deepEqual(setHeading(text, [1], 9, false), [1]);
  assert.throws(() => setHeading(text, [], 0, true), /超出/);
});

test('按校对后的分界重新分章并通过覆盖核对', () => {
  const text = source;
  const review = buildReview(text, [1, 12, 23, 34]);
  assert.equal(review.chapters.length, 4);
  assert.equal(review.chapters[0].title, '1、雨夜之1');
  assert.equal(review.integrity.ok, true);
  const expected = source.split('\n').filter(line => !/^\d+、/.test(line)).join('').replace(/\s/g, '').length;
  assert.equal(review.chapters.reduce((sum, chapter) => sum + chapter.body.replace(/\s/g, '').length, 0), expected);
});

test('没有分界时不生成校对结果', () => {
  assert.throws(() => buildReview(source, []), /至少保留一个分界/);
});
