import test from 'node:test';
import assert from 'node:assert/strict';
import {formatChapter,formatManuscript} from '../src/manuscript-format.js';
test('format protects Markdown semantics, code and prose while collapsing redundant blanks',()=>{
 const body='正文 \n\n\n下一段  \n```js\n代码 \n\n\n```\n    缩进代码 \n- 列表  \n';
 const result=formatChapter({title:'一',body});
 assert.equal(result.chapter.body,'正文\n\n下一段  \n```js\n代码 \n\n\n```\n    缩进代码 \n- 列表  \n');
 assert.equal(formatChapter(result.chapter).changed,false);
});
test('format migrates emoji and narrative anchors across multiple edits',()=>{
 const body='第一段 \n\n\n第二😀段 \n最后一段';
 const point=body.indexOf('😀');
 const result=formatChapter({body,pendingBreakpoints:[point]});
 assert.equal(result.chapter.body.slice(result.chapter.pendingBreakpoints[0],result.chapter.pendingBreakpoints[0]+2),'😀');
 assert.equal(result.removedBreakpoints,0);
 assert.deepEqual(formatManuscript([{body:'正文'}]).changes,[]);
});

test('format is conservative for HTML pre, disabled cleanup and large inputs',()=>{
 const body='<pre>\n内容 \n\n\n</pre>\n正文 \n\n\n';
 assert.equal(formatChapter({body}).chapter.body,'<pre>\n内容 \n\n\n</pre>\n正文\n\n');
 assert.equal(formatChapter({body:'正文 \n \n\n'}, {collapseBlank:false,trimTrailing:false}).changed,false);
 const long='长篇正文 \n\n\n'.repeat(30000)+'结尾';
 const result=formatChapter({body:long,pendingBreakpoints:[long.indexOf('结尾')]});
 assert.equal(result.chapter.body.slice(result.chapter.pendingBreakpoints[0]),'结尾');
 assert.equal(result.chapter.body.replace(/\s/g,''),long.replace(/\s/g,''));
});
