import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {bindBatchChapters} from '../src/batch-chapter-ui.js';
import {splitChapterAtPoints,mergeNextChapter} from '../src/chapter-edit.js';
import {storeDraft,loadDraft} from '../src/draft-store.js';
import {draftBackup,parseDraftBackup} from '../src/draft-manager.js';
import {breakpointMarkup} from '../src/chapter-breakpoint-view.js';
import {localReadingCopy} from '../src/local-books-core.js';

const work=()=>({draftKey:'pending-test',id:'pending-book',title:'断点回归',author:'作者',category:'奇幻',intro:'',status:'连载中',chapters:[{title:'第一章',body:'甲甲。乙乙。丙丙。'},{title:'第二章',body:'丁丁。戊戊。己己。'}]});

test('marked breaks survive editor rebinding, stay chapter-specific and clear only on body edits',()=>{
 const previous=globalThis.document,draft=work();let selected=0,saves=0;
 function bind(){
  const controls=new Map(),listeners={};
  globalThis.document={querySelector:selector=>{if(!controls.has(selector))controls.set(selector,{});return controls.get(selector);}};
  const editor={value:draft.chapters[selected].body,selectionStart:3,addEventListener:(type,fn)=>{listeners[type]=fn;}};
  bindBatchChapters({editor,getDraft:()=>draft,getSelected:()=>selected,onChange:()=>saves++,toast:()=>{}});
  return {cancel:offset=>controls.get('#chapter-breakpoint-list').onclick({target:{closest:()=>({hasAttribute:()=>offset===null,dataset:{breakRemove:String(offset)}})}}),mark:()=>controls.get('#mark-chapter-point').onclick(),count:()=>controls.get('#batch-chapter-split').textContent,input:()=>listeners.input()};
 }
 try{
  bind().mark();selected=1;const second=bind();assert.match(second.count(),/0 个断点/);second.mark();
  selected=0;const first=bind();assert.match(first.count(),/1 个断点/);assert.equal(saves,2);
  first.input();assert.match(first.count(),/0 个断点/);assert.equal(draft.chapters[0].pendingBreakpoints,undefined);
  selected=1;const remaining=bind();assert.match(remaining.count(),/1 个断点/);assert.equal(saves,3);remaining.mark();assert.match(remaining.count(),/0 个断点/);remaining.mark();remaining.cancel(3);assert.equal(draft.chapters[1].pendingBreakpoints,undefined);remaining.mark();remaining.cancel(null);assert.equal(draft.chapters[1].pendingBreakpoints,undefined);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('pending breaks persist through storage, draft transfer and chapter reordering',async()=>{
 const draft=work();draft.chapters[0].pendingBreakpoints=[3,6];draft.chapters[1].pendingBreakpoints=[6];
 await storeDraft(draft);const reopened=await loadDraft();
 assert.deepEqual(reopened.chapters.map(c=>c.pendingBreakpoints),[[3,6],[6]]);
 const restored=parseDraftBackup(draftBackup(reopened));restored.chapters.reverse();
 assert.deepEqual(restored.chapters.map(c=>c.pendingBreakpoints),[[6],[3,6]]);
 assert.notEqual(restored.draftKey,draft.draftKey);
 assert.ok(localReadingCopy(restored).chapters.every(c=>!('pendingBreakpoints'in c)));
});

test('splitting or merging consumes affected breaks while keeping other chapter plans and undo input intact',()=>{
 const draft=work();draft.chapters[0].pendingBreakpoints=[3];draft.chapters[1].pendingBreakpoints=[6];
 const result=splitChapterAtPoints(draft.chapters,0,[3]);
 assert.equal(result[0].pendingBreakpoints,undefined);assert.equal(result[1].pendingBreakpoints,undefined);
 assert.deepEqual(result[2].pendingBreakpoints,[6]);assert.deepEqual(draft.chapters[0].pendingBreakpoints,[3]);
 const merged=mergeNextChapter(draft.chapters,0);assert.equal(merged[0].pendingBreakpoints,undefined);
 assert.equal(result.slice(0,2).map(c=>c.body).join(''),draft.chapters[0].body);
});


test('breakpoint highlighting marks exact offsets, escapes manuscripts and preserves line breaks',()=>{
 const body='甲<script>\n乙乙。\n\n丙😀丁',html=breakpointMarkup(body,[1,11,11,18]);
 assert.ok(html.includes('&lt;script&gt;'));assert.equal((html.match(/data-pin=/g)||[]).length,3);
 assert.equal((html.match(/has-breakpoint/g)||[]).length,3);
 assert.equal(html.replace(/<[^>]*>/g,'').replaceAll('&#8203;','').replaceAll('&lt;','<').replaceAll('&gt;','>'),body);
 const long='甲'.repeat(100000)+'\n乙乙';assert.equal((breakpointMarkup(long,[50000,100002]).match(/data-pin=/g)||[]).length,2);
});
