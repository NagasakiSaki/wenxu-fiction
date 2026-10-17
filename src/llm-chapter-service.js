// 大模型分章：模型只负责"指出哪一行是标题"，返回的行号再由 smart-split 交给结构引擎，
// 在原文上重新切分并核对覆盖。即使模型编造行号或改写文字，也不会进入草稿。
import {chatLlm} from './llm-client.js';
import {parseForumHeading} from './forum-headings.js';
import {noiseVerdict} from './forum-noise.js';

export const MAX_LLM_CHARACTERS = 120_000;
export const LLM_CHUNK_CHARACTERS = 24_000;
export const CANDIDATE_MAX_LINE = 60;

const SYSTEM_PROMPT = [
  '你是中文网络小说的结构助手。用户会给出长文中的若干行，每行前面是全文行号。',
  '你的任务是找出真正的章节标题行。',
  '只输出 JSON，格式为 {"chapters":[{"line":12,"title":"第三章 雨夜"}]}。',
  '要求：line 必须来自用户给出的行号，不能编造；title 取该行原文，最多 30 字；',
  '忽略楼层、广告、翻页、日期、客户端签名等与故事无关的行；',
  '宁缺毋滥：不确定的行不要选，也不要输出任何解释文字。'
].join('\n');

const CANDIDATE_HINT = '下面只列出可能成为标题的行：行号是全文行号，未列出的行都是正文。不要为未列出的行输出章节。';

/**
 * 挑选可能成为标题的行：短行、不以句末标点结束，或本身就能被规则解析成标题。
 * 只发送这些行可以显著降低费用，也让正文尽量不出本机。
 */
export function candidateLines(lines, {maxLength = CANDIDATE_MAX_LINE} = {}) {
  const rows = [];
  lines.forEach((line, index) => {
    const text = String(line).trim();
    if (!text) return;
    if (noiseVerdict(text).remove) return; // 站点控件没有必要发给模型
    const parsed = parseForumHeading(text);
    const short = text.length <= maxLength && !/[。！？!?…”』」）)]$/.test(text);
    if (parsed || short) rows.push({number: index + 1, text});
  });
  return rows;
}

/** 把候选行拼成提示词；行号是全文行号，不是分段内的相对行号。 */
export function buildChapterMessages(rows, {startLine, endLine, mode = 'candidates', examples = []} = {}) {
  const numbered = rows.map(row => `${row.number}\t${row.text}`).join('\n');
  const messages = [{role: 'system', content: SYSTEM_PROMPT}];
  const scope = mode === 'candidates'
    ? `${CANDIDATE_HINT}\n共 ${rows.length} 行候选，行号从 ${startLine} 到 ${endLine}。`
    : `共 ${rows.length} 行，行号从 ${startLine} 到 ${endLine}。`;
  messages.push({role: 'user', content: `${scope}\n${numbered}`});
  if (examples.length) {
    messages.push({role: 'user', content: `作者已确认以下行是章节标题，请参考它们的写法：\n${examples.map(line => `第 ${line} 行`).join('、')}`});
  }
  return messages;
}

function extractJson(text) {
  const trimmed = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * 校验模型返回：行号必须落在本段范围内（候选模式还必须在候选集合里），
 * 标题非空且不超过 100 字。编造或重复的行号直接丢弃，不修改正文。
 */
export function parseChapterReply(text, {startLine, endLine, allowed} = {}) {
  const payload = extractJson(text);
  if (!payload) throw Error('模型的回答不是有效 JSON');
  const list = Array.isArray(payload) ? payload : payload.chapters;
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const line = Number(item?.line);
    const title = String(item?.title ?? '').trim().replace(/\s+/g, ' ').slice(0, 100);
    if (!Number.isInteger(line) || line < startLine || line > endLine) continue;
    if (allowed && !allowed.has(line)) continue; // 候选模式不允许对正文行下手
    if (!title || seen.has(line)) continue;
    seen.add(line);
    result.push({line, title});
  }
  return result.sort((a, b) => a.line - b.line);
}

function chunkRows(rows, budget) {
  const chunks = [];
  let current = [];
  let characters = 0;
  for (const row of rows) {
    const size = row.text.length + 8;
    if (current.length && characters + size > budget) {
      chunks.push(current);
      current = [];
      characters = 0;
    }
    current.push(row);
    characters += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function askChunk({rows, mode, examples, config, signal, fetchImpl, attempt}) {
  const startLine = rows[0].number;
  const endLine = rows[rows.length - 1].number;
  const messages = buildChapterMessages(rows, {startLine, endLine, mode, examples});
  if (attempt > 0) messages.push({role: 'user', content: '上一次回答无法解析。请只输出 JSON 对象，不要任何解释。'});
  const {text} = await chatLlm(config, {messages, maxTokens: 2000, temperature: 0, signal, fetchImpl});
  const allowed = mode === 'candidates' ? new Set(rows.map(row => row.number)) : undefined;
  return parseChapterReply(text, {startLine, endLine, allowed});
}

/**
 * 调用大模型识别章节标题行。
 * @param {{text:string, config:object, mode?:'candidates'|'full', examples?:number[]}} options
 * @returns {Promise<{lines:number[], titles:Array<{line:number,title:string}>, chunks:number, sentLines:number, sentCharacters:number}>}
 */
export async function llmChapterLines({
  text,
  config,
  mode = 'candidates',
  examples = [],
  fetchImpl,
  signal,
  onProgress = () => {},
  chunkCharacters = LLM_CHUNK_CHARACTERS,
  maxCharacters = MAX_LLM_CHARACTERS
} = {}) {
  const source = String(text ?? '');
  if (!source.trim()) throw Error('没有可发送的正文');
  if (mode !== 'candidates' && mode !== 'full') throw Error('发送模式无效');
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const rows = mode === 'candidates'
    ? candidateLines(lines)
    : lines.map((line, index) => ({number: index + 1, text: line}));
  if (!rows.length) throw Error('没有可以发送的候选行，可改用离线规则');
  const sentCharacters = rows.reduce((sum, row) => sum + row.text.length, 0);
  if (sentCharacters > maxCharacters) throw Error('候选行超过 12 万字符，请拆分文件；离线规则不受此限制');
  if (mode === 'full' && source.length > maxCharacters) throw Error('正文超过 12 万字符，大模型分章请先拆分文件；离线规则不受此限制');

  const chunks = chunkRows(rows, Math.max(4000, chunkCharacters));
  const tiles = [];
  for (let index = 0; index < chunks.length; index++) {
    if (signal?.aborted) throw Error('已取消大模型分章');
    onProgress({phase: 'request', done: index, total: chunks.length});
    let found;
    try {
      found = await askChunk({rows: chunks[index], mode, examples, config, signal, fetchImpl, attempt: 0});
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!/不是有效 JSON|没有返回内容/.test(error.message)) throw error;
      found = await askChunk({rows: chunks[index], mode, examples, config, signal, fetchImpl, attempt: 1});
    }
    tiles.push(...found);
    onProgress({phase: 'request', done: index + 1, total: chunks.length});
  }
  const seen = new Set();
  const unique = tiles.filter(item => (seen.has(item.line) ? false : (seen.add(item.line), true))).sort((a, b) => a.line - b.line);
  if (unique.length < 2) throw Error('大模型没有找到足够的章节标题，可改用离线规则或手动点选');
  return {lines: unique.map(item => item.line), titles: unique, chunks: chunks.length, sentLines: rows.length, sentCharacters};
}
