import test from 'node:test';
import assert from 'node:assert/strict';
import {withImportSource, sourceText, sourceStats, withoutImportSource, SOURCE_LIMIT} from '../src/draft-source.js';

const draft = {id: 'story-test-1', title: '测试', draftKey: 'key-1', chapters: [{title: '第一章', body: '正文'}]};

test('保存原文快照并读取统计信息', () => {
  const next = withImportSource(draft, '第一段\n第二段', {kind: 'smart-split', savedAt: 1000});
  assert.equal(sourceText(next), '第一段\n第二段');
  assert.deepEqual(sourceStats(next), {kind: 'smart-split', characters: 7, savedAt: 1000, format: 'wenxu-source-v1'});
  assert.equal(next.id, draft.id);
  assert.equal(draft.importSource, undefined, '不修改原对象');
});

test('空文本与超限文本不会写入快照', () => {
  assert.equal(withImportSource(draft, '   ').importSource, undefined);
  const huge = '字'.repeat(SOURCE_LIMIT + 1);
  assert.equal(withImportSource(draft, huge).importSource, undefined);
});

test('没有快照时返回空文本与 null 统计', () => {
  assert.equal(sourceText(draft), '');
  assert.equal(sourceStats(draft), null);
  assert.equal(sourceStats(null), null);
});

test('剥离快照用于公开导出，且不修改原对象', () => {
  const next = withImportSource(draft, '原文');
  const stripped = withoutImportSource(next);
  assert.equal('importSource' in stripped, false);
  assert.equal(stripped.title, '测试');
  assert.ok(next.importSource, '原草稿仍保留快照');
  assert.equal(withoutImportSource(draft), draft);
});
