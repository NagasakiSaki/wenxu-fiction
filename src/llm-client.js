// 纯逻辑模块：把配置翻译成 HTTP 请求并解析响应。
// 不接触 DOM、不写存储、不打印日志，UI、Worker 与 node --test 都可以直接复用。
import {providerById} from './llm-providers.js';

export const CHAT_TIMEOUT_MS = 60_000;
export const MODELS_TIMEOUT_MS = 20_000;

function trimText(value) {return typeof value === 'string' ? value.trim() : '';}
function stripTrailingSlash(url) {return url.replace(/\/+$/, '');}
function clampTemperature(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

// 列表请求通常发生在选模型之前，所以这里只校验地址和密钥，不要求 model。
function normalizeEndpoint(raw = {}) {
  const preset = providerById(raw.provider);
  const baseUrl = stripTrailingSlash(trimText(raw.baseUrl)) || stripTrailingSlash(preset.baseUrl);
  if (!baseUrl) throw Error('请填写服务地址');
  const apiKey = trimText(raw.apiKey);
  if (!apiKey && preset.needsKey) throw Error('请填写 API 密钥');
  return {provider: preset.id, kind: preset.kind, baseUrl, apiKey};
}

export function normalizeLlmConfig(raw = {}) {
  const endpoint = normalizeEndpoint(raw);
  const model = trimText(raw.model);
  if (!model) throw Error('请填写模型名称');
  return {provider: endpoint.provider, baseUrl: endpoint.baseUrl, model, apiKey: endpoint.apiKey, temperature: clampTemperature(raw.temperature)};
}

function bearerHeaders(apiKey) {
  const headers = {'Content-Type': 'application/json'};
  return apiKey ? {...headers, Authorization: `Bearer ${apiKey}`} : headers;
}

function anthropicHeaders(apiKey) {
  return {'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'};
}

// OpenAI 的 content 允许是字符串，也允许是 [{type:'text', text}] 分段。
function textOfContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => (typeof part === 'string' ? part : part?.text ?? '')).join('');
}

function collectSystem(messages) {
  return messages.filter(message => message.role === 'system').map(message => textOfContent(message.content)).filter(text => text.trim()).join('\n\n');
}

function buildOpenAiRequest(settings, {messages, maxTokens, temperature}) {
  return {
    url: `${settings.baseUrl}/chat/completions`,
    headers: bearerHeaders(settings.apiKey),
    body: {
      model: settings.model,
      messages: messages.map(({role, content}) => ({role, content})),
      max_tokens: maxTokens,
      temperature,
      stream: false,
    },
  };
}

function buildAnthropicRequest(settings, {messages, maxTokens, temperature}) {
  const system = collectSystem(messages);
  const body = {
    model: settings.model,
    max_tokens: maxTokens,
    temperature,
    messages: messages.filter(message => message.role !== 'system').map(({role, content}) => ({role, content})),
  };
  if (system) body.system = system;
  return {url: `${settings.baseUrl}/messages`, headers: anthropicHeaders(settings.apiKey), body};
}

function buildGeminiRequest(settings, {messages, maxTokens, temperature}) {
  const system = collectSystem(messages);
  const contents = messages
    .filter(message => message.role !== 'system')
    .map(({role, content}) => ({role: role === 'assistant' ? 'model' : 'user', parts: [{text: textOfContent(content)}]}));
  const body = {contents, generationConfig: {temperature, maxOutputTokens: maxTokens}};
  if (system) body.systemInstruction = {parts: [{text: system}]};
  const url = `${settings.baseUrl}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  return {url, headers: {'Content-Type': 'application/json'}, body};
}

function parseOpenAiText(payload) {
  return textOfContent(payload?.choices?.[0]?.message?.content);
}

function parseAnthropicText(payload) {
  return (payload?.content || []).map(part => part?.text ?? '').join('');
}

function parseGeminiText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || []).map(part => part?.text ?? '').join('');
}

function linkAbortSignals(signal, timeoutMs) {
  const timeoutController = new AbortController();
  const timer = Number.isFinite(timeoutMs) && timeoutMs > 0 ? setTimeout(() => timeoutController.abort(), timeoutMs) : null;
  const sources = signal ? [timeoutController.signal, signal] : [timeoutController.signal];
  if (typeof AbortSignal.any === 'function') return {signal: AbortSignal.any(sources), cleanup: () => timer && clearTimeout(timer)};
  // 老环境没有 AbortSignal.any，手动把两个信号桥接到同一个 controller。
  const controller = new AbortController();
  const detach = sources.map(source => {
    if (source.aborted) {
      controller.abort(source.reason);
      return null;
    }
    const listener = () => controller.abort(source.reason);
    source.addEventListener('abort', listener, {once: true});
    return () => source.removeEventListener('abort', listener);
  }).filter(Boolean);
  return {
    signal: controller.signal,
    cleanup() {
      if (timer) clearTimeout(timer);
      for (const remove of detach) remove();
    },
  };
}

function describeError(error) {return error instanceof Error ? error.message || error.name : String(error ?? '未知错误');}
function redactSecret(text, secret) {return secret ? text.split(secret).join('***') : text;}

// 400 的响应体只截 200 字，并且先抹掉密钥再拼进消息。
function truncateHint(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 200 ? `${clean.slice(0, 200)}…` : clean;
}

async function readErrorBody(response) {
  try {
    if (typeof response.text === 'function') return await response.text();
    const payload = await response.json();
    return typeof payload === 'string' ? payload : JSON.stringify(payload);
  } catch {
    return '';
  }
}

async function readHttpError(response, apiKey) {
  const status = response.status;
  if (status === 400) {
    const hint = truncateHint(redactSecret(await readErrorBody(response), apiKey));
    return Error(`服务拒绝请求：${hint || '请求参数无效'}`);
  }
  if (status === 401 || status === 403) return Error('密钥无效或没有该模型的权限');
  if (status === 404) return Error('服务地址或模型名称不存在');
  if (status === 408 || status === 504) return Error('模型服务响应超时');
  if (status === 429) return Error('请求过于频繁或额度不足');
  if (status >= 500) return Error(`模型服务暂时不可用（HTTP ${status}）`);
  return Error(`模型服务返回异常（HTTP ${status}）`);
}

async function readJsonBody(response, linkedSignal) {
  try {
    return await response.json();
  } catch (error) {
    if (linkedSignal.aborted || error?.name === 'AbortError') throw Error('请求超时或已取消');
    throw Error('模型服务返回了无法解析的数据');
  }
}

function transportError(error, linkedSignal, apiKey) {
  if (linkedSignal.aborted || error?.name === 'AbortError') return Error('请求超时或已取消');
  return Error(`无法连接模型服务：${redactSecret(describeError(error), apiKey)}`);
}

async function requestJson({fetchImpl, url, init, apiKey, signal, timeoutMs}) {
  const link = linkAbortSignals(signal, timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, {...init, signal: link.signal});
    } catch (error) {
      throw transportError(error, link.signal, apiKey);
    }
    if (!response.ok) throw await readHttpError(response, apiKey);
    return await readJsonBody(response, link.signal);
  } finally {
    link.cleanup();
  }
}

export async function chatLlm(config, {
  messages = [],
  maxTokens = 1200,
  temperature,
  signal,
  fetchImpl = fetch,
  timeoutMs = CHAT_TIMEOUT_MS,
} = {}) {
  const settings = normalizeLlmConfig(config);
  const kind = providerById(settings.provider).kind;
  const effectiveTemperature = temperature === undefined ? settings.temperature : clampTemperature(temperature);
  const options = {messages, maxTokens, temperature: effectiveTemperature};
  const request = kind === 'anthropic'
    ? buildAnthropicRequest(settings, options)
    : kind === 'gemini'
      ? buildGeminiRequest(settings, options)
      : buildOpenAiRequest(settings, options);
  const payload = await requestJson({
    fetchImpl,
    url: request.url,
    init: {method: 'POST', headers: request.headers, body: JSON.stringify(request.body)},
    apiKey: settings.apiKey,
    signal,
    timeoutMs,
  });
  const text = kind === 'anthropic' ? parseAnthropicText(payload) : kind === 'gemini' ? parseGeminiText(payload) : parseOpenAiText(payload);
  if (!text.trim()) throw Error('模型没有返回内容');
  return {text, usage: payload?.usage ?? payload?.usageMetadata ?? null, model: settings.model};
}

function buildModelsRequest(settings) {
  if (settings.kind === 'gemini') {
    return {url: `${settings.baseUrl}/models?key=${encodeURIComponent(settings.apiKey)}`, headers: {'Content-Type': 'application/json'}};
  }
  if (settings.kind === 'anthropic') return {url: `${settings.baseUrl}/models`, headers: anthropicHeaders(settings.apiKey)};
  return {url: `${settings.baseUrl}/models`, headers: bearerHeaders(settings.apiKey)};
}

function extractModelIds(payload, kind) {
  if (kind === 'gemini') return (payload?.models || []).map(item => trimText(item?.name).replace(/^models\//, '')).filter(Boolean);
  return (payload?.data || []).map(item => (typeof item === 'string' ? item : trimText(item?.id))).filter(Boolean);
}

export async function listLlmModels(config, {
  fetchImpl = fetch,
  signal,
  timeoutMs = MODELS_TIMEOUT_MS,
} = {}) {
  const settings = normalizeEndpoint(config);
  const request = buildModelsRequest(settings);
  const payload = await requestJson({
    fetchImpl,
    url: request.url,
    init: {method: 'GET', headers: request.headers},
    apiKey: settings.apiKey,
    signal,
    timeoutMs,
  });
  return extractModelIds(payload, settings.kind);
}

// 报告、导出和日志只使用脱敏副本。
export function redactLlmConfig(config = {}) {
  return {...config, apiKey: ''};
}

export function describeLlmConfig(config = {}) {
  const preset = providerById(config?.provider);
  const model = trimText(config?.model);
  return model ? `${preset.label} · ${model}` : preset.label;
}
