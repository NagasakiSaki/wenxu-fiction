import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatLlm,
  describeLlmConfig,
  listLlmModels,
  normalizeLlmConfig,
  redactLlmConfig,
} from '../src/llm-client.js';
import {LLM_PROVIDERS, providerById} from '../src/llm-providers.js';

const messages = [{role: 'system', content: '你是小说编辑'}, {role: 'user', content: '写一段雨夜'}];
const secret = 'sk-secret-value';

function headerValue(headers, name) {
  const key = Object.keys(headers || {}).find(item => item.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

function fakeFetch(responder) {
  const calls = [];
  const handler = typeof responder === 'function' ? responder : () => responder;
  async function fetchImpl(url, init = {}) {
    calls.push({url, init});
    return handler(url, init);
  }
  return {fetchImpl, calls};
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function errorResponse(status, body) {
  return {ok: false, status, json: async () => ({error: body}), text: async () => body};
}

test('配置补全预设地址、去掉尾部斜杠并限制温度范围', () => {
  const config = normalizeLlmConfig({
    provider: 'deepseek',
    baseUrl: ' https://api.deepseek.com/v1/// ',
    model: ' deepseek-chat ',
    apiKey: ' sk-demo ',
    temperature: 3,
  });
  assert.deepEqual(config, {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: 'sk-demo',
    temperature: 1,
  });
  assert.equal(normalizeLlmConfig({provider: 'ollama', model: 'qwen2.5:7b'}).baseUrl, 'http://127.0.0.1:11434/v1');
  assert.equal(normalizeLlmConfig({provider: 'openai', model: 'gpt-4o-mini', apiKey: 'k'}).temperature, 0);
  assert.equal(normalizeLlmConfig({provider: 'openai', model: 'gpt-4o-mini', apiKey: 'k', temperature: '0.42'}).temperature, 0.42);
  assert.equal(normalizeLlmConfig({provider: 'openai', model: 'gpt-4o-mini', apiKey: 'k', temperature: -1}).temperature, 0);
});

test('缺少模型、密钥或自定义地址时给出中文提示', () => {
  assert.throws(() => normalizeLlmConfig({provider: 'openai', apiKey: 'k'}), /请填写模型名称/);
  assert.throws(() => normalizeLlmConfig({provider: 'openai', model: 'gpt-4o-mini'}), /请填写 API 密钥/);
  assert.throws(() => normalizeLlmConfig({provider: 'custom', model: '本地模型'}), /请填写服务地址/);
  const custom = normalizeLlmConfig({provider: 'custom', baseUrl: 'http://10.0.0.5:8000/v1/', model: '本地模型'});
  assert.equal(custom.baseUrl, 'http://10.0.0.5:8000/v1');
  assert.equal(custom.apiKey, '');
});

test('未知供应商回落到自定义预设，本地服务无需密钥', () => {
  assert.equal(providerById('missing-provider').id, 'custom');
  assert.equal(providerById('ollama').needsKey, false);
  assert.equal(providerById('lmstudio').needsKey, false);
  assert.ok(LLM_PROVIDERS.length >= 13);
  for (const preset of LLM_PROVIDERS) {
    assert.ok(['openai', 'anthropic', 'gemini'].includes(preset.kind), preset.id);
    assert.ok(preset.models.every(model => typeof model === 'string'), preset.id);
  }
});

test('OpenAI 请求形状正确并解析字符串与分段内容', async () => {
  const config = normalizeLlmConfig({provider: 'deepseek', model: 'deepseek-chat', apiKey: 'sk-demo'});
  const replied = fakeFetch(jsonResponse({
    choices: [{message: {content: '夜色沉了下来。'}}],
    usage: {total_tokens: 12},
  }));
  const result = await chatLlm(config, {
    messages: [{role: 'system', content: '你是小说编辑'}, {role: 'user', content: '写一段'}],
    maxTokens: 500,
    temperature: 0.8,
    fetchImpl: replied.fetchImpl,
  });
  assert.equal(replied.calls.length, 1);
  assert.equal(replied.calls[0].url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(replied.calls[0].init.method, 'POST');
  assert.equal(headerValue(replied.calls[0].init.headers, 'authorization'), 'Bearer sk-demo');
  const body = JSON.parse(replied.calls[0].init.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.deepEqual(body.messages, [{role: 'system', content: '你是小说编辑'}, {role: 'user', content: '写一段'}]);
  assert.equal(body.max_tokens, 500);
  assert.equal(body.temperature, 0.8);
  assert.equal(body.stream, false);
  assert.equal(result.text, '夜色沉了下来。');
  assert.equal(result.model, 'deepseek-chat');
  assert.deepEqual(result.usage, {total_tokens: 12});
});

test('OpenAI 分段内容与无密钥的本地服务', async () => {
  const parts = fakeFetch(jsonResponse({
    choices: [{message: {content: [{type: 'text', text: '雨声'}, {type: 'text', text: '落在瓦上'}]}}],
  }));
  const config = normalizeLlmConfig({provider: 'ollama', model: 'qwen2.5:7b'});
  const result = await chatLlm(config, {messages, fetchImpl: parts.fetchImpl});
  assert.equal(result.text, '雨声落在瓦上');
  assert.equal(parts.calls[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(headerValue(parts.calls[0].init.headers, 'authorization'), undefined);
  assert.equal(JSON.parse(parts.calls[0].init.body).max_tokens, 1200);
});

test('Anthropic 请求合并 system 并拼接 content 文本', async () => {
  const config = normalizeLlmConfig({provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: 'sk-ant-demo'});
  const replied = fakeFetch(jsonResponse({
    content: [{type: 'text', text: '风'}, {type: 'text', text: '声'}],
    usage: {input_tokens: 8, output_tokens: 2},
  }));
  const result = await chatLlm(config, {
    messages: [
      {role: 'system', content: '第一条设定'},
      {role: 'system', content: '第二条设定'},
      {role: 'user', content: '写一段'},
      {role: 'assistant', content: '上次写到这里'},
    ],
    maxTokens: 64,
    temperature: 0.5,
    fetchImpl: replied.fetchImpl,
  });
  const {url, init} = replied.calls[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(headerValue(init.headers, 'x-api-key'), 'sk-ant-demo');
  assert.equal(headerValue(init.headers, 'anthropic-version'), '2023-06-01');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'claude-sonnet-4-20250514');
  assert.equal(body.max_tokens, 64);
  assert.equal(body.temperature, 0.5);
  assert.equal(body.system, '第一条设定\n\n第二条设定');
  assert.deepEqual(body.messages, [
    {role: 'user', content: '写一段'},
    {role: 'assistant', content: '上次写到这里'},
  ]);
  assert.equal(result.text, '风声');
});

test('Gemini 请求形状正确并解析 candidates 分段', async () => {
  const config = normalizeLlmConfig({provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'AIza-demo'});
  const replied = fakeFetch(jsonResponse({
    candidates: [{content: {parts: [{text: '灯'}, {text: '火'}]}}],
    usageMetadata: {totalTokenCount: 9},
  }));
  const result = await chatLlm(config, {
    messages: [
      {role: 'system', content: '你是小说编辑'},
      {role: 'user', content: '写一段'},
      {role: 'assistant', content: '上次写到这里'},
    ],
    maxTokens: 128,
    temperature: 0.7,
    fetchImpl: replied.fetchImpl,
  });
  const {url, init} = replied.calls[0];
  assert.ok(url.includes('/models/gemini-2.0-flash:generateContent?key=AIza-demo'), url);
  const body = JSON.parse(init.body);
  assert.deepEqual(body.contents, [
    {role: 'user', parts: [{text: '写一段'}]},
    {role: 'model', parts: [{text: '上次写到这里'}]},
  ]);
  assert.deepEqual(body.systemInstruction, {parts: [{text: '你是小说编辑'}]});
  assert.deepEqual(body.generationConfig, {temperature: 0.7, maxOutputTokens: 128});
  assert.equal(result.text, '灯火');
});

test('HTTP 错误映射为中文提示且不泄漏密钥', async () => {
  const config = {provider: 'openai', model: 'gpt-4o-mini', apiKey: secret};
  const cases = [
    [401, '密钥无效或没有该模型的权限'],
    [403, '密钥无效或没有该模型的权限'],
    [404, '服务地址或模型名称不存在'],
    [429, '请求过于频繁或额度不足'],
    [500, '模型服务暂时不可用（HTTP 500）'],
    [503, '模型服务暂时不可用（HTTP 503）'],
  ];
  for (const [status, expected] of cases) {
    const replied = fakeFetch(errorResponse(status, `失败响应 ${secret}`));
    await assert.rejects(chatLlm(config, {messages, fetchImpl: replied.fetchImpl}), error => {
      assert.equal(error.message, expected);
      assert.ok(!error.message.includes(secret));
      return true;
    });
  }
  const longBody = `invalid ${secret} `.repeat(40);
  const bad = fakeFetch(errorResponse(400, longBody));
  await assert.rejects(chatLlm(config, {messages, fetchImpl: bad.fetchImpl}), error => {
    assert.match(error.message, /^服务拒绝请求：/);
    assert.ok(!error.message.includes(secret));
    assert.ok(error.message.length < 230, `${error.message.length}`);
    return true;
  });
});

test('网络失败给出可读提示且不泄漏密钥', async () => {
  const config = {provider: 'openai', model: 'gpt-4o-mini', apiKey: secret};
  const replied = fakeFetch(() => { throw new TypeError(`fetch failed with ${secret}`); });
  await assert.rejects(chatLlm(config, {messages, fetchImpl: replied.fetchImpl}), error => {
    assert.match(error.message, /^无法连接模型服务：/);
    assert.ok(error.message.includes('fetch failed'));
    assert.ok(!error.message.includes(secret));
    return true;
  });
});

test('空内容与超时都会报错', async () => {
  const config = {provider: 'openai', model: 'gpt-4o-mini', apiKey: secret};
  const blank = fakeFetch(jsonResponse({choices: [{message: {content: '   '}}]}));
  await assert.rejects(chatLlm(config, {messages, fetchImpl: blank.fetchImpl}), /模型没有返回内容/);
  const hanging = fakeFetch((url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  }));
  await assert.rejects(
    chatLlm(config, {messages, fetchImpl: hanging.fetchImpl, timeoutMs: 20}),
    /请求超时或已取消/,
  );
});

test('listLlmModels 读取 OpenAI 与 Gemini 风格的模型列表', async () => {
  const openai = fakeFetch(jsonResponse({data: [{id: 'gpt-4o-mini'}, {id: 'gpt-4o'}]}));
  assert.deepEqual(
    await listLlmModels({provider: 'openai', apiKey: 'sk-demo'}, {fetchImpl: openai.fetchImpl}),
    ['gpt-4o-mini', 'gpt-4o'],
  );
  assert.equal(openai.calls[0].url, 'https://api.openai.com/v1/models');
  assert.equal(headerValue(openai.calls[0].init.headers, 'authorization'), 'Bearer sk-demo');

  const gemini = fakeFetch(jsonResponse({models: [{name: 'models/gemini-2.0-flash'}, {name: 'models/gemini-1.5-pro'}]}));
  assert.deepEqual(
    await listLlmModels({provider: 'gemini', apiKey: 'AIza-demo'}, {fetchImpl: gemini.fetchImpl}),
    ['gemini-2.0-flash', 'gemini-1.5-pro'],
  );
  assert.equal(gemini.calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models?key=AIza-demo');

  const denied = fakeFetch(errorResponse(401, secret));
  await assert.rejects(listLlmModels({provider: 'openai', apiKey: secret}, {fetchImpl: denied.fetchImpl}), error => {
    assert.equal(error.message, '密钥无效或没有该模型的权限');
    assert.ok(!error.message.includes(secret));
    return true;
  });
});

test('redactLlmConfig 去掉密钥，describeLlmConfig 含供应商与模型', () => {
  const config = normalizeLlmConfig({provider: 'deepseek', model: 'deepseek-chat', apiKey: 'sk-demo'});
  const safe = redactLlmConfig(config);
  assert.deepEqual(safe, {...config, apiKey: ''});
  assert.notEqual(safe, config);
  assert.equal(safe.apiKey, '');
  assert.equal(describeLlmConfig(config), 'DeepSeek · deepseek-chat');
  assert.equal(describeLlmConfig({provider: 'ollama', model: 'qwen2.5:7b'}), 'Ollama（本地） · qwen2.5:7b');
});
