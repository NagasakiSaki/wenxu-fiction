import test from 'node:test';import assert from 'node:assert/strict';
import {analyseChapters} from '../src/chapter-analysis.js';
import {normalizeImportedText,decodeDocumentText} from '../src/document-model.js';
import {validateBook} from '../src/model.js';
const meta='【作品进度】第1集至第45集\n【第一卷《开始》】（第1-10集）';
test('same 45 episodes in Markdown, plain TXT and DOCX-style bold paragraphs',()=>{
 for(const format of ['md','txt','docx']){
  const mark=s=>format==='md'?'## '+s:format==='docx'?'**'+s+'**':s;
  const title=format==='md'?'# 测试长篇':format==='docx'?'**测试长篇**':'测试长篇';
  const text=title+'\n\n——副标题\n'+meta+'\n\n========================================\n\n'+Array.from({length:45},(_,i)=>mark(`第${i+1}集：测试剧情`)+ '\n\n'+('这是正文。\n\n'.repeat(1200))).join('\n\n');
  const r=analyseChapters(normalizeImportedText(text));assert.equal(r.chapters.length,45,format);assert.equal(r.title,'测试长篇',format);assert.ok(text.length>200000);assert.ok(r.chapters[44].title.startsWith('第45集'));assert.equal(r.chapters[0].body.match(/这是正文/g).length,1200);assert.ok(r.frontMatter.includes('作品进度'));
  validateBook({id:'long-book',title:r.title,author:'作者',intro:'',category:'科幻',status:'已完结',chapters:r.chapters});
 }
});
test('episode brackets with suffix, ranges and completion markers are distinct',()=>{const r=analyseChapters('《书名》\n【分集规划】\n【第11集 - 第22集重构分集深度规划】\n【第11集】雨夜\n正文甲\n**第11集完结**\n【第12集】晨光\n正文乙');assert.equal(r.chapters.length,2);assert.equal(r.chapters[0].title,'第11集：雨夜');assert.match(r.chapters[0].body,/第11集完结/);});
test('GB18030 and UTF16 encoded episode markers decode without losing boundaries',()=>{const utf16=new Uint8Array([255,254,...Buffer.from('第一集：开始\n正文\n第二集：后来\n正文','utf16le')]);assert.equal(analyseChapters(decodeDocumentText(utf16).text).chapters.length,2);const gb=new Uint8Array([0xb5,0xda,0xd2,0xbb,0xbc,0xaf,10,0xd5,0xfd,0xce,0xc4]);assert.equal(analyseChapters(decodeDocumentText(gb).text).chapters[0].title,'第一集');});
