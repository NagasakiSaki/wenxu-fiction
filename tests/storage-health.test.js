import test from 'node:test';
import assert from 'node:assert/strict';
import {formatBytes, usageLevel, isBackup, selectBackups, backupSummaryText, BACKUP_LIMIT} from '../src/storage-health.js';

test('字节格式化覆盖常见量级', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5 MB');
  assert.equal(formatBytes(2 * 1024 ** 3), '2 GB');
});

test('配额水位分为充足、偏高与接近上限', () => {
  assert.deepEqual(usageLevel(50, 100).level, 'ok');
  assert.deepEqual(usageLevel(80, 100).level, 'warn');
  assert.deepEqual(usageLevel(95, 100).level, 'full');
  assert.equal(usageLevel(1, 0).level, 'unknown');
  assert.equal(usageLevel(200, 100).ratio, 1);
});

test('备份识别只看标题约定并排除回收站', () => {
  assert.equal(isBackup({title: '雨夜 · 智能分章前备份'}), true);
  assert.equal(isBackup({title: '雨夜 · 清空前备份'}), true);
  assert.equal(isBackup({title: '雨夜'}), false);
  assert.equal(isBackup({title: '雨夜 · 智能分章前备份', trashed: true}), false);
});

test('轮换保留最近若干份，当前草稿与回收站不参与', () => {
  const summaries = Array.from({length: 20}, (_, index) => ({
    key: `backup-${index}`,
    title: `作品 · 第${index}次备份`,
    updatedAt: 1000 - index
  }));
  summaries.push({key: 'current', title: '当前草稿', updatedAt: 2000});
  summaries.push({key: 'trashed', title: '旧稿 · 备份', updatedAt: 3000, trashed: true});
  const {keep, remove} = selectBackups(summaries, {limit: 12, keepKeys: ['current']});
  assert.equal(keep.length, 12);
  assert.equal(remove.length, 8);
  assert.deepEqual(keep.map(item => item.key), Array.from({length: 12}, (_, index) => `backup-${index}`));
  assert.deepEqual(remove.map(item => item.key), Array.from({length: 8}, (_, index) => `backup-${index + 12}`));
  assert.ok(!keep.some(item => item.key === 'current'));
  assert.ok(!remove.concat(keep).some(item => item.key === 'trashed'));
});

test('备份不足上限时不清理', () => {
  const summaries = Array.from({length: BACKUP_LIMIT - 1}, (_, index) => ({key: `b${index}`, title: '某作品 · 操作前备份', updatedAt: index}));
  assert.equal(selectBackups(summaries).remove.length, 0);
  assert.equal(backupSummaryText(summaries), `${BACKUP_LIMIT - 1} 份操作前备份`);
  assert.equal(backupSummaryText([]), '还没有操作前备份');
});
