import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChapterReply, buildChapterMessages, llmChapterLines, candidateLines} from '../src/llm-chapter-service.js';

const config = {provider: 'custom', baseUrl: 'https://llm.example.com/v1', model: 'demo-model', apiKey: 'sk-test-key'};

function reply(content) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {choices: [{message: {content}}]};
    },
    async text() {
      return '';
    }
  };
}

test('候选行只保留短行与可解析标题，长段落不发送', () => {
  const lines = ['1、雨夜', '正文。', '他抬头看了一眼远处的灯，没有说话，街上的人已经散尽，只剩一辆自行车靠在墙边。', '【12】旧信', '2023-05-01'];
  const rows = candidateLines(lines);
  assert.deepEqual(rows.map(row => row.number), [1, 4]);
  assert.ok(rows.every(row => row.text.length <= 60));
});

test('候选模式提示词声明未列出的行都是正文', () => {
  const rows = [{number: 41, text: '第一章 雨夜'}, {number: 42, text: '第二章 旧信'}];
  const messages = buildChapterMessages(rows, {startLine: 41, endLine: 42, mode: 'candidates'});
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /只输出 JSON/);
  assert.match(messages[1].content, /未列出的行都是正文/);
  assert.match(messages[1].content, /行号从 41 到 42/);
  assert.match(messages[1].content, /41\t第一章 雨夜/);
});

test('作者示例会作为额外提示附在最后', () => {
  const rows = [{number: 1, text: '第一章'}];
  const messages = buildChapterMessages(rows, {startLine: 1, endLine: 1, mode: 'full', examples: [3, 9]});
  assert.match(messages.at(-1).content, /第 3 行、第 9 行/);
});

test('解析模型回答时丢弃越界、重复、空标题与不在候选集合里的行', () => {
  const allowed = new Set([5, 6]);
  const parsed = parseChapterReply('{"chapters":[{"line":5,"title":"第五章"},{"line":5,"title":"重复"},{"line":99,"title":"越界"},{"line":7,"title":"正文行"},{"line":6,"title":"第六章"}]}', {startLine: 5, endLine: 10, allowed});
  assert.deepEqual(parsed.map(item => item.line), [5, 6]);
  assert.equal(parsed[0].title, '第五章');
});

test('无效 JSON 会给出明确错误', () => {
  assert.throws(() => parseChapterReply('我觉得第三章是标题', {startLine: 1, endLine: 3}), /不是有效 JSON/);
});

test('候选模式只把短行发给模型，长正文不出本机', async () => {
  const longProse = '他抬头看了一眼远处的灯，没有说话，街上的人已经散尽，只剩一辆自行车靠在墙边。'.repeat(2);
  const text = ['1、雨夜', longProse, '2、旧信', longProse, '3、渡口', longProse].join('\n');
  let prompt = '';
  const fetchImpl = async (url, init) => {
    prompt = JSON.parse(init.body).messages.map(message => message.content).join('\n');
    const numbers = [...prompt.matchAll(/^(\d+)\t/gmu)].map(match => Number(match[1]));
    return reply(JSON.stringify({chapters: numbers.map(number => ({line: number, title: `第${number}行`}))}));
  };
  const result = await llmChapterLines({text, config, fetchImpl});
  assert.equal(result.sentLines, 3);
  assert.ok(!prompt.includes('街上的人已经散尽'));
  assert.deepEqual(result.lines, [1, 3, 5]);
});

test('全文模式仍然可用，并带上正文', async () => {
  const text = '第一章\n正文内容。\n第二章\n正文内容。';
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    assert.match(body.messages.at(-1).content, /正文内容/);
    return reply('{"chapters":[{"line":1,"title":"第一章"},{"line":3,"title":"第二章"}]}');
  };
  const result = await llmChapterLines({text, config, fetchImpl, mode: 'full'});
  assert.deepEqual(result.lines, [1, 3]);
});

test('回答无法解析时重试一次并采用第二次结果', async () => {
  let attempt = 0;
  const fetchImpl = async () => {
    attempt++;
    return reply(attempt === 1 ? '抱歉，我先想一想。' : '{"chapters":[{"line":1,"title":"第一章"},{"line":3,"title":"第二章"}]}');
  };
  const result = await llmChapterLines({text: '第一章\n正文\n第二章\n正文', config, fetchImpl});
  assert.equal(attempt, 2);
  assert.deepEqual(result.lines, [1, 3]);
});

test('标题不足、候选超限与取消都会中止', async () => {
  const empty = async () => reply('{"chapters":[{"line":1,"title":"只有一章"}]}');
  await assert.rejects(() => llmChapterLines({text: '第一行\n第二行', config, fetchImpl: empty}), /没有找到足够的章节标题/);
  const many = Array.from({length: 300}, (_, index) => `第${index + 1}条候选短行`).join('\n');
  await assert.rejects(() => llmChapterLines({text: many, config, fetchImpl: empty, maxCharacters: 100}), /超过 12 万字符/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => llmChapterLines({text: '第一行\n第二行', config, fetchImpl: empty, signal: controller.signal}), /已取消/);
});

test('请求失败沿用客户端的中文错误', async () => {
  const unauthorized = async () => ({ok: false, status: 401, async text() { return 'unauthorized'; }, async json() { return {}; }});
  await assert.rejects(() => llmChapterLines({text: '第一行\n第二行', config, fetchImpl: unauthorized}), /密钥无效/);
});
