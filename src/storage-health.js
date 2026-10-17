// 本机存储的配额判断与备份轮换规则。纯函数，便于在没有浏览器环境时回归。
export const BACKUP_LIMIT = 12;
export const WARN_RATIO = 0.75;
export const FULL_RATIO = 0.9;

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  const rounded = unit === 0 || Number.isInteger(size) || size >= 10 ? Math.round(size) : Number(size.toFixed(1));
  return `${rounded} ${units[unit]}`;
}

export function usageLevel(usage, quota) {
  if (!quota || quota <= 0) return {ratio: 0, level: 'unknown'};
  const ratio = Math.min(1, Math.max(0, usage / quota));
  return {ratio, level: ratio >= FULL_RATIO ? 'full' : ratio >= WARN_RATIO ? 'warn' : 'ok'};
}

/** 备份的识别只看标题约定：所有操作前备份都以“备份”结尾或包含“前备份”。 */
export function isBackup(summary) {
  const title = String(summary?.title || '');
  return /备份/.test(title) && !summary?.trashed;
}

/**
 * 选出应该清理的备份：保留最近 limit 份，当前草稿与回收站中的项目永不清理。
 * summaries 需按 updatedAt 倒序（listDrafts 已保证）。
 */
export function selectBackups(summaries, {limit = BACKUP_LIMIT, keepKeys = []} = {}) {
  const keep = new Set(keepKeys);
  const backups = summaries.filter(item => isBackup(item) && !keep.has(item.key));
  const sorted = [...backups].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return {keep: sorted.slice(0, limit), remove: sorted.slice(limit)};
}

export function backupSummaryText(summaries) {
  const backups = summaries.filter(isBackup);
  return backups.length ? `${backups.length} 份操作前备份` : '还没有操作前备份';
}
