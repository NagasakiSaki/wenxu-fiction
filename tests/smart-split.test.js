import test from 'node:test';
import assert from 'node:assert/strict';
import {detectNoise, cleanLines, noiseSummary} from '../src/forum-noise.js';
import {parseForumHeading, detectForumHeadings, describeForumTemplate} from '../src/forum-headings.js';
import {smartSplit, applySmartSplit, rebaseBreakpoints, mergeShortChapters, chapterRanges, draftText, orderDiagnostics} from '../src/smart-split.js';
import {runSmartSplit} from '../src/smart-split-engine.js';

const paragraph = '雨点敲在瓦上，他抬头看了一眼远处的灯，没有说话。街上的人已经散尽，只剩一辆自行车靠在墙边。';
const prose = (count = 8) => Array.from({length: count}, () => paragraph).join('\n');
const forumNoise = [
  '回复',
  '赞(12)',
  '收藏 分享 举报',
  '来自iPhone客户端',
  '本章未完，请点击下一页继续阅读',
  '请记住本站域名 www.example-novel.com',
  '发表于 2023-5-1 12:00',
  '上一页 下一页',
  '第 3 / 12 页',
  'http://www.example-novel.com/read/1'
];

function numberedSource(count = 4) {
  return Array.from({length: count}, (_, index) => [
    `${index + 1}、雨夜之${index + 1}`,
    prose(),
    ...forumNoise
  ].join('\n')).join('\n');
}

test('站点杂讯只删除明确的控件行，叙事正文保留', () => {
  const lines = ['回复', '雨点敲在瓦上，他抬头看了一眼远处的灯，没有说话。', '本章未完，请点击下一页继续阅读', '来自iPhone客户端', ''];
  const removal = detectNoise(lines);
  assert.deepEqual([...removal.remove], [0, 2, 3]);
  assert.equal(removal.entries.length, 3);
  assert.ok(removal.counts['forum-bar'] >= 1);
  assert.ok(noiseSummary(removal).includes('楼层控件'));
});

test('长叙事句里出现站点提示词时保留并标注待核对', () => {
  const line = '他想起那句被人反复叮嘱的话，请记住本站并不是什么善意，只是一个陷阱，说完便转身离开。';
  const verdict = detectNoise([line]);
  assert.equal(verdict.remove.size, 0);
  assert.equal(verdict.suspects.length, 1);
  assert.match(verdict.suspects[0].evidence[0], /保留待核对/);
});

test('纯符号行与未标注的普通句子都能正确区分', () => {
  const removal = detectNoise(['★☆★', '他走了。']);
  assert.deepEqual([...removal.remove], [0]);
  assert.equal(cleanLines(['★☆★', '他走了。'], removal).length, 1);
});

test('标题结构解析覆盖括号编号、纯数字与英文、并拒绝正文句', () => {
  assert.equal(parseForumHeading('1、雨夜').signature, '#、');
  assert.equal(parseForumHeading('【12】雨夜').family, 'bracket-number');
  assert.equal(parseForumHeading('【第十二章】雨夜').number, 12);
  assert.equal(parseForumHeading('12').family, 'bare-number');
  assert.equal(parseForumHeading('Chapter 4 Night').number, 4);
  assert.equal(parseForumHeading('1998年，他走了。'), null);
  assert.equal(parseForumHeading('三、他走了。'), null);
  assert.equal(parseForumHeading('这是一段没有编号也没有标点的短行'), null);
});

test('规律标题要求同形重复、间隔较长且编号递增', () => {
  const lines = [];
  for (let index = 1; index <= 5; index++) {
    lines.push(`${index}、标题${index}`);
    lines.push(...prose().split('\n'));
  }
  const detection = detectForumHeadings(lines);
  assert.equal(detection.headings.length, 5);
  assert.equal(detection.confidence, 'medium');
  assert.match(describeForumTemplate(detection.template), /重复 5 次/);

  // 间隔过短时不当作章节标题，避免把正文里的编号列表切开。
  const crowded = [];
  for (let index = 1; index <= 5; index++) {
    crowded.push(`${index}、标题${index}`, '很短的一段正文。');
  }
  assert.equal(detectForumHeadings(crowded).headings.length, 0);
});

test('明确章节词合并同一族的多种写法', () => {
  const lines = [];
  for (let index = 1; index <= 3; index++) {
    lines.push(`第${index}章 正文标题`, ...prose().split('\n'));
    lines.push(`第${index}回 另一版本`, ...prose().split('\n'));
  }
  const detection = detectForumHeadings(lines);
  assert.equal(detection.headings.length, 6);
  assert.equal(detection.confidence, 'high');
});

test('整篇智能分章：先过滤杂讯，再按规律标题分章并保留完整性', () => {
  const source = numberedSource(4);
  const result = smartSplit(source, {minChars: 200});
  assert.equal(result.chapters.length, 4);
  assert.equal(result.chapters[0].title, '1、雨夜之1');
  assert.equal(result.method, '规律标题识别');
  assert.equal(result.metrics.removedLines, forumNoise.length * 4);
  assert.ok(result.integrity.ok);
  // 过滤后的正文逐字来自原文，不插入、不改写。
  assert.ok(result.chapters.every(chapter => !chapter.body.includes('请记住本站')));
  assert.equal(result.metrics.bodyCharacters, 4 * prose().length);
});

test('已有明确章节标题时沿用结构引擎，不重复做规律推断', () => {
  const source = Array.from({length: 3}, (_, index) => [`第${index + 1}章 雨夜`, prose()].join('\n')).join('\n');
  const result = smartSplit(source, {minChars: 200});
  assert.equal(result.method, '明确章节标题');
  assert.equal(result.chapters.length, 3);
  assert.equal(result.forum, null);
});

test('大模型给出的分界行交给引擎验证，正文仍按原文还原', () => {
  const source = numberedSource(3);
  const clean = source.split('\n').filter(line => !forumNoise.includes(line));
  const headingLines = clean.flatMap((line, index) => (parseForumHeading(line) ? [index + 1] : []));
  const result = smartSplit(source, {llmLines: headingLines, minChars: 200});
  assert.equal(result.method, '大模型分章');
  assert.equal(result.chapters.length, 3);
  assert.ok(result.integrity.ok);
});

test('某章吞掉大部分正文时用规律标题补足分界，并保留已有标题', () => {
  const lines = ['第1章 开端', ...prose(6).split('\n'), '第2章 中段', ...prose(6).split('\n')];
  for (let index = 1; index <= 4; index++) lines.push(`${index}、后续${index}`, ...prose(20).split('\n'));
  const result = smartSplit(lines.join('\n'), {minChars: 200});
  assert.equal(result.method, '规律标题识别');
  assert.equal(result.chapters[0].title, '第1章 开端');
  assert.equal(result.chapters[1].title, '第2章 中段');
  assert.equal(result.chapters.length, 6);
  assert.ok(result.integrity.ok);
});

test('编号顺序体检只报告异常，不改动章节', () => {
  const flip = [
    {title: '第3章', body: prose(2)},
    {title: '第2章', body: prose(2)},
    {title: '第1章', body: prose(2)}
  ];
  const notes = orderDiagnostics(flip);
  assert.ok(notes.some(note => note.code === 'descending-number'));
  assert.equal(flip[0].title, '第3章');

  const gap = [{title: '第1章', body: prose(2)}, {title: '第5章', body: prose(2)}];
  assert.ok(orderDiagnostics(gap).some(note => note.code === 'number-gap'));
  assert.deepEqual(orderDiagnostics([{title: '第一章', body: '甲'}, {title: '第二章', body: '乙'}]), []);
});

test('碎章合并有保护：短章超过一半时整体放弃合并', () => {
  const chapters = [1, 2, 3, 4].map(index => ({title: `第${index}章`, body: '很短。'}));
  const result = mergeShortChapters(chapters, {minChars: 400});
  assert.equal(result.skipped, true);
  assert.equal(result.chapters.length, 4);

  const mixed = [
    {title: '第一章', body: Array.from({length: 10}, () => paragraph).join('\n')},
    {title: '第二章', body: '只有一行。'},
    {title: '第三章', body: Array.from({length: 10}, () => paragraph).join('\n')},
    {title: '第四章', body: Array.from({length: 10}, () => paragraph).join('\n')}
  ];
  const merged = mergeShortChapters(mixed, {minChars: 400});
  assert.equal(merged.merged, 1);
  assert.equal(merged.chapters.length, 3);
  assert.ok(merged.chapters[0].body.includes('只有一行。'));
});

test('重新分章时把手动断点迁移到新章节，跨越边界的断点被丢弃', () => {
  const before = [
    {title: '旧一', body: '甲乙丙丁', pendingBreakpoints: [2]},
    {title: '旧二', body: '戊己庚辛', pendingBreakpoints: [1]}
  ];
  const after = [
    {title: '新一', body: '甲乙'},
    {title: '新二', body: '丙丁\n戊己'},
    {title: '新三', body: '庚辛'}
  ];
  const mapped = rebaseBreakpoints(before, after);
  // 旧断点落在“丙丁/戊己”之间，映射到新第二章内部；落在新章节边界的断点直接丢弃。
  assert.deepEqual(mapped[1].pendingBreakpoints, [3]);
  assert.equal(mapped[0].pendingBreakpoints, undefined);
  assert.equal(mapped[2].pendingBreakpoints, undefined);
});

test('断点迁移不会把断点放进代理对内部', () => {
  const before = [{title: '旧', body: '👩‍🚀甲', pendingBreakpoints: [1]}];
  const after = [{title: '新', body: '👩‍🚀甲'}];
  const mapped = rebaseBreakpoints(before, after);
  assert.equal(mapped[0].pendingBreakpoints?.[0], undefined);
});

test('整篇文本与章节区间使用同一套拼接规则', () => {
  const chapters = [{title: '一', body: '甲'}, {title: '二', body: '乙'}];
  assert.equal(draftText(chapters), '甲\n乙');
  assert.deepEqual(chapterRanges(chapters), [{start: 0, end: 1}, {start: 2, end: 3}]);
});

test('应用智能分章时生成独立编号的备份', () => {
  const draft = {id: 'story-test-1', title: '测试', draftKey: 'old', chapters: [{title: '旧', body: prose(2)}]};
  const result = smartSplit(numberedSource(3), {minChars: 100});
  const {next, backup} = applySmartSplit(draft, result);
  assert.equal(next.chapters.length, 3);
  assert.notEqual(backup.draftKey, 'old');
  assert.match(backup.title, /智能分章前备份/);
  assert.equal(draft.chapters.length, 1, '原草稿对象不应被修改');
});

test('长章可按篇幅生成断点建议', () => {
  const source = [`第1章 长章`, Array.from({length: 120}, () => paragraph).join('\n')].join('\n');
  const result = smartSplit(source, {suggestLongChapterBreaks: true, breakTarget: 800, minChars: 100});
  assert.ok(result.metrics.suggestedBreakpoints >= 1);
  const points = result.chapters.flatMap(chapter => chapter.pendingBreakpoints || []);
  assert.ok(points.length >= 1);
  assert.ok(points.every(point => Number.isInteger(point) && point > 0));
});

test('空文本与超限文本给出明确错误', () => {
  assert.throws(() => smartSplit('   '), /没有可分析的正文/);
  assert.throws(() => smartSplit('回复\n回复\n回复\n'), /没有剩余正文|没有可分析的正文/);
});

test('没有 Worker 的环境同步回退，结果与直接调用一致', async () => {
  const source = numberedSource(4);
  const viaEngine = await runSmartSplit(source, {minChars: 200});
  const direct = smartSplit(source, {minChars: 200});
  assert.equal(viaEngine.chapters.length, direct.chapters.length);
  assert.equal(viaEngine.method, direct.method);
  assert.equal(viaEngine.cleanedText, direct.cleanedText);
  assert.equal(viaEngine.integrity.ok, true);
  await assert.rejects(() => runSmartSplit('   '), /没有可分析的正文/);
});
