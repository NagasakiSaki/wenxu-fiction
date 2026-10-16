import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
const legacy=new Map();globalThis.localStorage={getItem:key=>legacy.get(key)||null,removeItem:key=>legacy.delete(key)};
const {loadDraft,storeDraft,listDrafts,getDraft,setDraftTrashed}=await import('../src/draft-store.js');
test('migrate old draft then persist a large Chinese manuscript and ordered snapshots',async()=>{
 const old={title:'旧草稿',chapters:[{title:'第一集',body:'旧正文'}]};legacy.set('wenxu-draft',JSON.stringify(old));assert.deepEqual(await loadDraft(),old);assert.equal(legacy.has('wenxu-draft'),false);
 const large={title:'长篇',chapters:[{title:'第一集',body:'长篇中文正文'.repeat(170000)}]};await storeDraft(large);assert.deepEqual(await loadDraft(),large);
 const next={title:'保存时刻',chapters:[]};const a=storeDraft(next);next.title='不应污染快照';await a;assert.equal((await loadDraft()).title,'保存时刻');
 await Promise.all([storeDraft({title:'第一版'}),storeDraft({title:'第二版'})]);assert.equal((await loadDraft()).title,'第二版');
});
test('multiple drafts are isolated and recoverable; same published ID can have separate versions',async()=>{
 const a={id:'book-one',draftKey:'slot-a',title:'作品甲',chapters:[{title:'第一章',body:'甲正文'}]},b={id:'book-one',draftKey:'slot-b',title:'作品乙',chapters:[{title:'第一章',body:'乙正文'}]};
 await storeDraft(a);await storeDraft(b);assert.equal((await getDraft('slot-a')).chapters[0].body,'甲正文');assert.equal((await getDraft('slot-b')).chapters[0].body,'乙正文');assert.ok((await listDrafts()).some(d=>d.key==='slot-a'));
 await setDraftTrashed('slot-a',true);assert.equal((await listDrafts()).some(d=>d.key==='slot-a'),false);assert.ok((await listDrafts({trashed:true})).some(d=>d.key==='slot-a'));await setDraftTrashed('slot-a',false);assert.ok((await listDrafts()).some(d=>d.key==='slot-a'));assert.equal((await getDraft('slot-a')).chapters[0].body,'甲正文');
});
