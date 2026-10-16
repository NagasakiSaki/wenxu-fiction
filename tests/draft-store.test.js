import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
const legacy=new Map();globalThis.localStorage={getItem:key=>legacy.get(key)||null,removeItem:key=>legacy.delete(key)};
const {loadDraft,storeDraft}=await import('../src/draft-store.js');
test('migrate old draft then persist a large Chinese manuscript and ordered snapshots',async()=>{
 const old={title:'旧草稿',chapters:[{title:'第一集',body:'旧正文'}]};legacy.set('wenxu-draft',JSON.stringify(old));assert.deepEqual(await loadDraft(),old);assert.equal(legacy.has('wenxu-draft'),false);
 const large={title:'长篇',chapters:[{title:'第一集',body:'长篇中文正文'.repeat(170000)}]};await storeDraft(large);assert.deepEqual(await loadDraft(),large);
 const next={title:'保存时刻',chapters:[]};const a=storeDraft(next);next.title='不应污染快照';await a;assert.equal((await loadDraft()).title,'保存时刻');
 await Promise.all([storeDraft({title:'第一版'}),storeDraft({title:'第二版'})]);assert.equal((await loadDraft()).title,'第二版');
});
