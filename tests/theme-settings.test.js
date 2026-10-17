import test from 'node:test';
import assert from 'node:assert/strict';
import {SKINS, normalizeSkin, nextSkin, skinLabel, saveSkin, loadSkin} from '../src/theme.js';
import {loadLlmSettings, saveLlmSettings, clearLlmSettings, llmConfig, llmStatusText, hasLlmKey} from '../src/llm-settings.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    dump: () => Object.fromEntries(map)
  };
}

test('风格只有纸墨与版画，未知值回退到纸墨', () => {
  assert.deepEqual(SKINS.map(skin => skin.id), ['paper', 'woodcut']);
  assert.equal(normalizeSkin('woodcut'), 'woodcut');
  assert.equal(normalizeSkin('dark'), 'paper');
  assert.equal(normalizeSkin(undefined), 'paper');
});

test('风格循环切换与按钮文案', () => {
  assert.equal(nextSkin('paper'), 'woodcut');
  assert.equal(nextSkin('woodcut'), 'paper');
  assert.equal(nextSkin('unknown'), 'woodcut');
  assert.equal(skinLabel('paper'), '纸墨 ◧');
  assert.equal(skinLabel('woodcut'), '版画 ◧');
});

test('风格选择写入本机并在下次读取', () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(loadSkin(), 'paper');
  saveSkin('woodcut');
  assert.equal(loadSkin(), 'woodcut');
  assert.equal(globalThis.localStorage.getItem('wenxu-skin'), 'woodcut');
  delete globalThis.localStorage;
});

test('大模型设置默认值、保存与清除', () => {
  globalThis.localStorage = fakeStorage();
  globalThis.sessionStorage = fakeStorage();
  clearLlmSettings();
  const initial = loadLlmSettings();
  assert.equal(initial.provider, 'deepseek');
  assert.equal(initial.apiKey, '');
  assert.equal(hasLlmKey(initial), false);

  saveLlmSettings({provider: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', apiKey: 'sk-demo', temperature: 0.3, remember: true});
  const saved = loadLlmSettings();
  assert.equal(saved.provider, 'moonshot');
  assert.equal(saved.model, 'moonshot-v1-8k');
  assert.equal(saved.apiKey, 'sk-demo');
  assert.equal(saved.temperature, 0.3);
  assert.deepEqual(llmConfig(saved), {provider: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', apiKey: 'sk-demo', temperature: 0.3});
  assert.equal('remember' in llmConfig(saved), false);
  assert.match(llmStatusText(saved), /大模型就绪/);

  clearLlmSettings();
  const cleared = loadLlmSettings();
  assert.equal(cleared.apiKey, '');
  assert.equal(hasLlmKey(cleared), false);
  assert.match(llmStatusText(cleared), /未配置/);
});

test('不记住密钥时只留在本次会话，不写入本地存储', () => {
  const local = fakeStorage();
  const session = fakeStorage();
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  clearLlmSettings();
  saveLlmSettings({provider: 'openai', baseUrl: '', model: 'gpt-4o-mini', apiKey: 'sk-session-only', temperature: 0, remember: false});
  const loaded = loadLlmSettings();
  assert.equal(loaded.apiKey, 'sk-session-only');
  assert.equal(local.getItem('wenxu-llm-key'), null);
  assert.ok(session.getItem('wenxu-llm-key-session'));
  const stored = JSON.stringify(local.dump());
  assert.equal(stored.includes('sk-session-only'), false, '密钥不应出现在本地配置里');
  clearLlmSettings();
});

test('本地模型可以不填密钥', () => {
  globalThis.localStorage = fakeStorage();
  globalThis.sessionStorage = fakeStorage();
  clearLlmSettings();
  saveLlmSettings({provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b', apiKey: '', temperature: 0, remember: true});
  const loaded = loadLlmSettings();
  assert.equal(hasLlmKey(loaded), false);
  assert.equal(loaded.provider, 'ollama');
  assert.match(llmStatusText(loaded), /就绪/);
  clearLlmSettings();
});
