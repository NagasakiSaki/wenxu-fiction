// 站点杂讯识别：贴吧楼层、转载站广告、翻页条和客户端签名与故事无关。
// 误删叙事正文无法撤销，所以只有证据明确的行才会被删除；可疑行保留并交回预览界面。
const NARRATIVE_END = /[。！？!?…”』」）)]$/;
const CJK = /[\u3400-\u9fff]/;
const WORD = /[\p{L}\p{N}]/u;
const MAX_KEYWORD_LINE = 40;

const CONTROL_TOKEN = /^(?:回复|引用|点评|赞|点赞|踩|顶|收藏|分享|举报|打分|签到|关注|私信|转发|评论|打赏|投币|投票)(?:\s*[（(]?\s*\d+\s*[)）]?)?$/u;
const NAV_TOKEN = /^(?:上一页|下一页|上一章|下一章|返回列表|返回首页|首页|尾页|目录|章节目录|全部章节|加入书签|投推荐票|开始阅读|继续阅读|最新章节)(?:\s*[»›>→]*)?$/u;

function isTokenBar(line, token) {
  const parts = line.split(/[\s·|｜,，/]+/u).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every(part => token.test(part));
}

// 强证据：整行本身就是站点控件，出现即删除。
const STRICT_RULES = [
  {code: 'forum-bar', label: '楼层控件', test: line => CONTROL_TOKEN.test(line)},
  {code: 'control-bar', label: '控件条', test: line => isTokenBar(line, CONTROL_TOKEN)},
  {code: 'nav-bar', label: '翻页导航', test: line => NAV_TOKEN.test(line) || isTokenBar(line, NAV_TOKEN)},
  {code: 'floor-number', label: '楼层编号', test: line => /^(?:第\s*)?\d{1,4}\s*(?:楼|层|L)$/iu.test(line)},
  {code: 'page-count', label: '分页计数', test: line => /^(?:第\s*\d+\s*\/\s*\d+\s*页|共\s*\d+\s*页|\d+\s*\/\s*\d+)$/u.test(line)},
  {code: 'site-url', label: '网址与联系邮箱', test: line => /^(?:https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.\w+)$/iu.test(line)},
  {code: 'date-only', label: '时间行', test: line => /^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/u.test(line) || /^\d{1,2}:\d{2}(?::\d{2})?$/u.test(line) || /^IP\s*属地\s*[:：]/iu.test(line)},
  {code: 'client-sign', label: '客户端签名', test: line => /^[—–\-~～\s]*(?:来自|本楼来自|发自)\s*[^，,。]{0,24}(?:客户端|iPhone|iPad|Android|手机|网页|贴吧)/iu.test(line)},
  {code: 'reply-quote', label: '回复引用', test: line => /^(?:>|＞|》)|^\s*@[\w\u4e00-\u9fff-]{2,20}\s|^\s*〔?\s*回复\s+@?[^:：]{1,24}[:：]/u.test(line)},
  {code: 'emoji-only', label: '纯符号行', test: line => !CJK.test(line) && !WORD.test(line)}
];

// 关键词规则：只有整行很短、且不像叙事句时才删除，避免删掉台词或正文里的同一句话。
const KEYWORD_RULES = [
  {code: 'site-copy', label: '站点提示语', test: line => /本章未完|点击下一页|请记住本站|最新网址|手机版阅读|手机用户请|加入书签|章节报错|错误举报|内容举报|版权举报|本站域名|备用网址|防失联|关注公众号|微信公众号|书友群|QQ群|企鹅群|百度搜索|搜索引擎/u.test(line)},
  {code: 'timestamp', label: '时间与来源', test: line => /^\s*(?:发表于|发表时间|最后编辑|本帖最后由|编辑于|更新于)\s*[:：]?/u.test(line)},
  {code: 'ad-line', label: '推荐与广告', test: line => /^(?:推荐阅读|相关推荐|热门推荐|猜你喜欢|广告|赞助|本书由|版权声明|免责声明|声明[:：])/u.test(line)},
  {code: 'site-brand', label: '站点落款', test: line => /(?:笔趣阁|顶点小说|铅笔小说|uu看书|新笔趣阁|笔趣读|全本小说网|飘天文学|书书网|落秋中文|奇书网|顶点文学|热书库)/u.test(line)}
];

function evaluate(line) {
  const clean = line.trim();
  if (!clean) return {remove: false, code: null, label: '', evidence: []};
  for (const rule of STRICT_RULES) {
    if (!rule.test(clean)) continue;
    return {remove: true, code: rule.code, label: rule.label, evidence: [`命中${rule.label}`]};
  }
  for (const rule of KEYWORD_RULES) {
    if (!rule.test(clean)) continue;
    if (clean.length > MAX_KEYWORD_LINE || NARRATIVE_END.test(clean)) {
      return {remove: false, code: rule.code, label: rule.label, evidence: [`命中${rule.label}，但整行像正文，保留待核对`], suspect: true};
    }
    return {remove: true, code: rule.code, label: rule.label, evidence: [`命中${rule.label}`]};
  }
  // 贴吧/转载站常用裸站点名做落款，规则里不写死具体网站时用通用判断。
  if (clean.length <= 16 && /(?:小说网|文学网|中文网|阅读网|书城)$/u.test(clean) && !NARRATIVE_END.test(clean)) {
    return {remove: true, code: 'site-brand', label: '站点落款', evidence: ['命中站点落款']};
  }
  return {remove: false, code: null, label: '', evidence: []};
}

/** 单行判定，供只关心“这一行是不是站点控件”的调用方使用。 */
export function noiseVerdict(line) {
  return evaluate(line);
}

/**
 * 逐行判定站点杂讯。
 * @param {string[]} lines 已统一换行的原始行
 * @returns {{remove: Set<number>, entries: Array, suspects: Array, counts: Record<string, number>, removedCharacters: number}}
 */
export function detectNoise(lines) {
  const remove = new Set();
  const entries = [];
  const suspects = [];
  const counts = {};
  let removedCharacters = 0;
  lines.forEach((line, index) => {
    const verdict = evaluate(line);
    if (!verdict.remove) {
      if (verdict.suspect) suspects.push({line: index + 1, code: verdict.code, label: verdict.label, text: line.trim().slice(0, 60), evidence: verdict.evidence});
      return;
    }
    remove.add(index);
    removedCharacters += line.trim().length;
    counts[verdict.code] = (counts[verdict.code] || 0) + 1;
    entries.push({line: index + 1, code: verdict.code, label: verdict.label, text: line.trim().slice(0, 60), evidence: verdict.evidence});
  });
  return {remove, entries, suspects, counts, removedCharacters};
}

/** 依据删除集合生成清洗后的行数组。 */
export function cleanLines(lines, removal) {
  return lines.filter((_, index) => !removal.remove.has(index));
}

const LABELS = new Map([...STRICT_RULES, ...KEYWORD_RULES].map(rule => [rule.code, rule.label]));

/** 面向界面的中文摘要，例如“楼层控件 12 行 · 站点提示语 3 行”。 */
export function noiseSummary(removal) {
  const parts = Object.entries(removal.counts).map(([code, count]) => `${LABELS.get(code) || code} ${count} 行`);
  return parts.length ? parts.join(' · ') : '未发现站点杂讯';
}
