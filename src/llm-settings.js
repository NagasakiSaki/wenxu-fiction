// 大模型配置的本机存储。密钥与作品数据分开保存：草稿、导出文件和公开作品都不包含它。
// 存储不可用（隐私模式、无 DOM 的测试环境）时退回内存，界面仍可本次使用。
const CONFIG_KEY = 'wenxu-llm-config';
const SECRET_KEY = 'wenxu-llm-key';
const SESSION_KEY = 'wenxu-llm-key-session';
const memory = new Map();

const emptySettings = () => ({provider: 'deepseek', baseUrl: '', model: '', apiKey: '', temperature: 0, remember: true});

function localStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function sessionStore() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(store, key) {
  try {
    const value = store?.getItem(key) ?? memory.get(key) ?? null;
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(store, key, value) {
  const text = JSON.stringify(value);
  memory.set(key, text);
  try {
    store?.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

function removeKey(store, key) {
  memory.delete(key);
  try {
    store?.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

export function loadLlmSettings() {
  const local = localStore();
  const session = sessionStore();
  const saved = readJson(local, CONFIG_KEY) || {};
  const persisted = readJson(local, SECRET_KEY) || {};
  const current = readJson(session, SESSION_KEY) || {};
  return {
    ...emptySettings(),
    ...saved,
    apiKey: typeof current.apiKey === 'string' ? current.apiKey : typeof persisted.apiKey === 'string' ? persisted.apiKey : '',
    remember: saved.remember !== false
  };
}

/** 保存设置。remember 为 false 时密钥只存在于本次会话。 */
export function saveLlmSettings(settings) {
  const {apiKey = '', remember = true, ...rest} = settings;
  writeJson(localStore(), CONFIG_KEY, {...rest, remember});
  removeKey(localStore(), SECRET_KEY);
  removeKey(sessionStore(), SESSION_KEY);
  if (!String(apiKey).trim()) return true;
  return remember
    ? writeJson(localStore(), SECRET_KEY, {apiKey})
    : writeJson(sessionStore(), SESSION_KEY, {apiKey});
}

export function clearLlmSettings() {
  removeKey(localStore(), CONFIG_KEY);
  removeKey(localStore(), SECRET_KEY);
  removeKey(sessionStore(), SESSION_KEY);
}

export function hasLlmKey(settings) {
  return Boolean(String(settings?.apiKey || '').trim());
}

/** 交给 llm-client 的最小配置；不带 remember 等界面字段。 */
export function llmConfig(settings) {
  return {
    provider: settings?.provider || 'custom',
    baseUrl: settings?.baseUrl || '',
    model: settings?.model || '',
    apiKey: settings?.apiKey || '',
    temperature: Number(settings?.temperature) || 0
  };
}

export function llmStatusText(settings) {
  const local = settings?.provider === 'ollama' || settings?.provider === 'lmstudio';
  if (!local && !hasLlmKey(settings)) return '未配置大模型 · 离线规则可用';
  if (!settings?.model) return '大模型尚未填写模型名称';
  return `大模型就绪 · ${settings.model}`;
}
