import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChapterReply, buildChapterMessages, llmChapterLines} from '../src/llm-chapter-service.js';

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

test('提示词带全文行号与只输出 JSON 的约束', () => {
  const messages = buildChapterMessages(['第一章 雨夜', '正文'], 41);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /只输出 JSON/);
  assert.match(messages[1].content, /41\t第一章 雨夜/);
  assert.match(messages[1].content, /42\t正文/);
  assert.match(messages[1].content, /行号从 41 到 42/);
});

test('解析模型回答时丢弃越界、重复与空标题', () => {
  const parsed = parseChapterReply('```json\n{"chapters":[{"line":5,"title":"第五章"},{"line":5,"title":"重复"},{"line":99,"title":"越界"},{"line":7,"title":"  "},{"line":6,"title":"第六章"}]}\n```', {startLine: 5, endLine: 10});
  assert.deepEqual(parsed.map(item => item.line), [5, 6]);
  assert.equal(parsed[0].title, '第五章');
});

test('无效 JSON 会给出明确错误', () => {
  assert.throws(() => parseChapterReply('我觉得第三章是标题', {startLine: 1, endLine: 3}), /不是有效 JSON/);
});

test('长文按段请求，行号在全文范围内合并', async () => {
  const calls = [];
  const text = Array.from({length: 40}, (_, index) => (index % 10 === 0 ? `第${index / 10 + 1}章 雨夜` : `第${index + 1}行正文内容`)).join('\n');
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const prompt = body.messages.at(-1).content;
    calls.push(prompt);
    const numbers = [...prompt.matchAll(/^(\d+)\t/gmu)].map(match => Number(match[1]));
    const start = numbers[0];
    const end = numbers.at(-1);
    const chapters = numbers.filter(number => /第\d+章 雨夜/.test(prompt.split('\n').find(line => line.startsWith(`${number}\t`)) || '')).map(number => ({line: number, title: `第${number}行`}));
    assert.ok(chapters.length >= 0);
    return reply(JSON.stringify({chapters: chapters.length ? chapters : [{line: start, title: '起点'}, {line: end, title: '终点'}]}));
  };
  const progress = [];
  const result = await llmChapterLines({text, config, fetchImpl, chunkCharacters: 4000, onProgress: event => progress.push(event)});
  assert.equal(result.chunks, 1);
  assert.ok(result.lines.length >= 2);
  assert.ok(result.lines.every(line => line >= 1 && line <= 40));
  assert.ok(progress.length >= 1);
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

test('标题不足、文本过长与取消都会中止', async () => {
  const empty = async () => reply('{"chapters":[{"line":1,"title":"只有一章"}]}');
  await assert.rejects(() => llmChapterLines({text: '第一行\n第二行', config, fetchImpl: empty}), /没有找到足够的章节标题/);
  await assert.rejects(() => llmChapterLines({text: '字'.repeat(200), config, fetchImpl: empty, maxCharacters: 100}), /超过 12 万字符/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => llmChapterLines({text: '第一行\n第二行', config, fetchImpl: empty, signal: controller.signal}), /已取消/);
});

test('请求失败沿用客户端的中文错误', async () => {
  const unauthorized = async () => ({ok: false, status: 401, async text() { return 'unauthorized'; }, async json() { return {}; }});
  await assert.rejects(() => llmChapterLines({text: '第一行\n第二行', config, fetchImpl: unauthorized}), /密钥无效/);
});
