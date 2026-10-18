// 长篇编辑渲染基准：只测纯字符串处理（高亮镜像 HTML、整篇智能分章），
// 不启动浏览器，因此不能代表手机 WebView 的真实帧率；设备数据仍需真机记录。
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {breakpointMarkup} from '../src/chapter-breakpoint-view.js';
import {smartSplit} from '../src/smart-split.js';
import {migrateBreakpoints} from '../src/breakpoint-migration.js';

const round = value => Math.round(value * 100) / 100;

function measure(label, fn, {repeat = 3} = {}) {
  const runs = [];
  let output = '';
  for (let index = 0; index < repeat; index++) {
    const start = performance.now();
    output = fn();
    runs.push(performance.now() - start);
  }
  const sorted = [...runs].sort((a, b) => a - b);
  return {label, medianMs: round(sorted[Math.floor(sorted.length / 2)]), minMs: round(sorted[0]), maxMs: round(sorted.at(-1)), outputBytes: Buffer.byteLength(output)};
}

function textOf(characters, lineLength = 100) {
  const unit = '这是一段用于测量编辑渲染的合成正文，人物在雨里走了很久，直到街灯熄灭。';
  const line = unit.repeat(Math.ceil(lineLength / unit.length)).slice(0, lineLength);
  return Array.from({length: Math.ceil(characters / (lineLength + 1))}, () => line).join('\n');
}

function spreadPoints(length, count) {
  return Array.from({length: count}, (_, index) => Math.floor((length / (count + 1)) * (index + 1)));
}

const longBody = textOf(2_000_000, 100);
const singleLine = textOf(100_000, 100_000);
const mediumBody = textOf(200_000, 100);
const points = spreadPoints(longBody.length, 999);
const singleLinePoints = spreadPoints(singleLine.length, 200);

const cases = [
  measure('近2,000,000字符 / 999断点 / 首部插入迁移', () => JSON.stringify(migrateBreakpoints(longBody,'新'+longBody,points,{start:0,end:0,inputType:'insertText'}))),
  measure('2,000,000 字符 / 999 断点', () => breakpointMarkup(longBody, points)),
  measure('200,000 字符 / 0 断点（仅转义）', () => breakpointMarkup(mediumBody, [])),
  measure('100,000 字符长单行 / 200 断点', () => breakpointMarkup(singleLine, singleLinePoints), {repeat: 3})
];

// 智能分章：30 万字符的贴吧式文本，含楼层杂讯与规律标题。
const forum = Array.from({length: 120}, (_, index) => [
  `${index + 1}、第${index + 1}节`,
  textOf(2_400, 80),
  '回复',
  '赞(12)',
  '来自iPhone客户端',
  '本章未完，请点击下一页继续阅读'
].join('\n')).join('\n');
const splitStart = performance.now();
const split = smartSplit(forum, {minChars: 800});
const splitMs = performance.now() - splitStart;

const integrity = {
  breakpointPinsMatch: (breakpointMarkup(longBody, points).match(/data-pin=/g) || []).length === new Set(points).size,
  splitIntegrity: split.integrity?.ok === true,
  splitChapters: split.chapters.length,
  splitRemovedLines: split.noise.entries.length
};

const report = {
  scope: '纯 JavaScript 字符串处理，Node ' + process.version + '；不含浏览器布局、输入法与 WebView 因素，不能当作手机渲染帧率。',
  generatedAt: new Date().toISOString(),
  cases,
  smartSplit: {characters: forum.length, chapters: split.chapters.length, noiseLines: split.noise.entries.length, elapsedMs: round(splitMs), method: split.method},
  integrity
};

if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.table(cases.map(({label, medianMs, minMs, maxMs, outputBytes}) => ({场景: label, 中位耗时毫秒: medianMs, 最小: minMs, 最大: maxMs, 输出字节: outputBytes})));
console.log(JSON.stringify({smartSplit: report.smartSplit, integrity}, null, 2));
if (!integrity.breakpointPinsMatch || !integrity.splitIntegrity) process.exitCode = 1;
