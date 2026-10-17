// 抓取原文快照：只保存在本机草稿里，便于重新分析或对照，不进入公开作品与阅读副本。
// 快照会随“备份当前草稿”一起导出（那是作者自己的备份），但不会上传。
export const SOURCE_FORMAT = 'wenxu-source-v1';
export const SOURCE_LIMIT = 2_000_000;

export function withImportSource(draft, text, {kind = 'smart-split', savedAt = Date.now()} = {}) {
  const value = String(text ?? '');
  if (!value.trim()) return draft;
  if (value.length > SOURCE_LIMIT) return draft; // 超过上限时不保存，避免把草稿撑爆
  return {
    ...draft,
    importSource: {
      format: SOURCE_FORMAT,
      kind,
      savedAt,
      characters: value.length,
      text: value
    }
  };
}

export function sourceText(draft) {
  const source = draft?.importSource;
  return typeof source?.text === 'string' ? source.text : '';
}

export function sourceStats(draft) {
  const source = draft?.importSource;
  if (!source || typeof source.text !== 'string' || !source.text.trim()) return null;
  return {
    kind: source.kind || 'smart-split',
    characters: source.text.length,
    savedAt: Number(source.savedAt) || 0,
    format: source.format || ''
  };
}

/** 导出公开作品、生成阅读副本前剥离快照。 */
export function withoutImportSource(value) {
  if (!value || typeof value !== 'object' || !('importSource' in value)) return value;
  const {importSource, ...rest} = value;
  return rest;
}
