import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadableBook} from '../src/book-download.js';
import {validateBook} from '../src/model.js';
test('download exports a whitelisted reading copy and distinct valid chapter files',()=>{
 const source={id:'a'.repeat(80),title:'作品'.repeat(50),author:'作者',intro:'简介',category:'其他',status:'连载中',importSource:'private',importNotes:['private'],chapters:[{title:'章节',body:'正文',volume:'一卷',pendingBreakpoints:[1],private:'secret',sections:[{title:'一节',paragraph:0,private:'secret'}]}]};
 const full=downloadableBook(source),single=downloadableBook(source,0);
 assert.equal(JSON.stringify(full).includes('private'),false);
 assert.equal(JSON.stringify(full).includes('secret'),false);
 assert.equal(full.chapters[0].volume,'一卷');
 assert.notEqual(single.id,source.id);
 assert.equal(validateBook(single),single);
 assert.throws(()=>downloadableBook(source,10));
 assert.equal(source.chapters[0].pendingBreakpoints[0],1);
});
