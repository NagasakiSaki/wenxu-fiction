import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSerialPosts} from '../src/forum-serial.js';
import {smartSplit,prepareSource} from '../src/smart-split.js';
import {analyseImportedChapters} from '../src/import-analysis.js';
import {analyseVisualPlan} from '../src/visual-source-model.js';
import {buildReview} from '../src/boundary-review.js';
import {runChapterAnalysis} from '../src/chapter-engine.js';
import {analyseChapters} from '../src/chapter-analysis.js';
import {importReport} from '../src/import-review-model.js';

const prose='甲乙丙丁戊己。'+('旅人沿着河岸前行，晨光照亮了远处的城门。'.repeat(12));
const dice='[角色甲]我选择留下。\n1-5等待\n6-10出发\n[rd100=69]\n> 这是信里的原话\n×';
const nav='⚙\n你好\n示例用户\n登录\n消息\n首页\nN G A\n论坛导航';
const post=(n,body)=>`#${n}示例作者 111111\n级别: 学徒威望: 1注册: 25-01-01\n2026-01-01 12:${String(n).padStart(2,'0')}\n7\u200B\n\n${body}\n附件\n显示全部附件\n改动\n在2026-01-02 12:00修改\n`;
const bodies=[
 '故事说明。\n第0话 星辰\n'+prose+'\n'+dice,
 '第0话剧情预计在旅途结束后继续\n'+prose+'\n第1话 海岸\n'+prose+'\n第一话 海岸 完',
 '第二话 回声\n'+prose+'\n第二话 回声 完\n第三话 风声',
 '第三话 风声\n'+prose,
 '第四话 晨光\n'+prose,
 '第五话 归途\n'+prose,
 '第六话 远航\n'+prose,
 '示例作品 入学篇\n第一话 新客\n'+prose
];
const source=nav+'\n'+bodies.map((b,i)=>(i===4?nav+'\n':'')+post(i,b)).join('\n');

test('forum serial recognition requires repeated strong headers outside code fences',()=>{
 assert.equal(inspectSerialPosts(['#1示例作者 111111','仅是台词']).recognized,false);
 assert.equal(inspectSerialPosts(post(0,prose).split('\n')).recognized,false);
 assert.equal(inspectSerialPosts(('```\n'+source+'\n```').split('\n')).recognized,false);
 assert.equal(inspectSerialPosts(source.split('\n')).posts.length,8);
});
test('file import yields eight episodes plus preface, keeps source lines and archives metadata',()=>{
 const r=analyseImportedChapters(source);
 assert.equal(r.metrics.volumeCount,1);assert.equal(r.metrics.uncertainCount,r.serial.roles.filter(r=>r.needsReview||r.kind==='repeat').length);
 assert.equal(r.chapters.length,9);assert.equal(r.serial.posts.length,8);assert.equal(r.integrity.ok,true);assert.equal(r.integrity.bodyExact,true);
 assert.equal(r.chapters.at(-1).volume,'示例作品 入学篇');
 assert.ok(r.frontMatter.includes('示例作品 入学篇'));assert.ok(!r.chapters.slice(0,-1).some(c=>c.body.includes('示例作品 入学篇')));
 assert.ok(r.frontMatter.includes('111111'));assert.ok(r.frontMatter.includes('显示全部附件'));
 assert.ok(r.chapters.every(c=>!c.body.includes('111111')&&!c.body.includes('级别:')));
 for(const c of r.chapters.slice(1))assert.equal(source.split('\n')[c.sourceStartLine-1],c.title);
 assert.ok(r.diagnostics.some(d=>d.code==='serial-repeat'));
 assert.ok(r.diagnostics.some(d=>d.code==='serial-start'));
 assert.ok(!r.diagnostics.some(d=>d.code==='sequence-gap'&&d.line===r.chapters.at(-1).sourceStartLine));
});
test('chapter endings, commentary, repeats, dice, choices, quote lines and symbols remain prose',()=>{
 const r=smartSplit(source),body=r.chapters.map(c=>c.body).join('\n');
 assert.equal(r.chapters.length,9);assert.equal(r.metrics.mergedChapters,0);
 for(const text of [dice,'第一话 海岸 完','第二话 回声 完','第0话剧情预计在旅途结束后继续'])assert.ok(body.includes(text),text);
 assert.ok(r.chapters.find(c=>c.title==='第三话 风声').body.includes('第三话 风声'));
 assert.ok(r.serial.roles.some(r=>r.kind==='arc'));
 assert.equal(r.serial.roles.filter(r=>r.kind==='ending').length,2);
 assert.equal(r.serial.roles.filter(r=>r.kind==='commentary').length,1);
});
test('source mapping remains exact after cleanup and manual review retains arc ownership',()=>{
 const prepared=prepareSource(source),r=smartSplit(source);
 const clean=r.cleanedText.split('\n');
 for(let i=0;i<clean.length;i++)assert.equal(clean[i],prepared.lines[r.serial.sourceLines[i]-1]);
 const reviewed=buildReview(r.cleanedText,r.boundaryLines,{serial:r.serial});
 assert.equal(reviewed.chapters.length,9);assert.equal(reviewed.integrity.ok,true);assert.equal(reviewed.chapters.at(-1).volume,'示例作品 入学篇');
});
test('visual splitting maps through archived forum headers without dropping narrative',()=>{
 const base=analyseImportedChapters(source),offset=source.indexOf('甲乙丙丁戊己')+3;
 const result=analyseVisualPlan(source,{visualPlan:{headingLines:base.boundaryLines,splitOffsets:[offset]}});
 assert.equal(result.chapters.length,10);assert.equal(result.integrity.ok,true);
 assert.equal(result.chapters.map(c=>c.body).join(''),base.chapters.map(c=>c.body).join(''));
 assert.equal(result.chapters.at(-1).volume,'示例作品 入学篇');
 assert.throws(()=>analyseVisualPlan(source,{visualPlan:{headingLines:base.boundaryLines,splitOffsets:[source.indexOf('#1')+1]}}),/归档/);
});
test('ordinary text and explicit opt-out keep the existing chapter analyzer behavior',async()=>{
 const plain='第一章 雨\n'+prose+'\n第二章 灯\n'+prose;
 assert.deepEqual(analyseImportedChapters(plain),analyseChapters(plain));
 const {forumSerial,...ordinary}=analyseImportedChapters(source,{forumSerial:false});assert.equal(forumSerial,false);assert.deepEqual(ordinary,analyseChapters(source));
 const fallback=await runChapterAnalysis(source);assert.equal(fallback.chapters.length,9);assert.equal(fallback.integrity.ok,true);
});
test('forum posts without titles remain one readable work rather than dice-number chapters',()=>{
 const input=Array.from({length:4},(_,i)=>post(i,dice+'\n'+prose)).join('\n');
 const r=analyseImportedChapters(input);assert.equal(r.chapters.length,1);assert.equal(r.integrity.ok,true);
 assert.ok(!r.chapters[0].body.includes('111111'));assert.ok(r.chapters[0].body.includes(dice));
});
test('archive line validation rejects invalid coordinates and metadata as a selected heading',()=>{
 assert.throws(()=>analyseChapters('甲\n乙',{archiveLines:[0]}),/归档/);
 assert.throws(()=>analyseChapters('甲\n乙',{archiveLines:[1],boundaryLines:[1]}),/标题/);
});


test('public structural reports omit newly recognized post authors, IDs and body text',()=>{
 const analysis=analyseImportedChapters(source),report=importReport({chapters:analysis.chapters,sources:[{analysis,method:analysis.method}],failed:[],skipped:[]});
 const serialized=JSON.stringify(report);
 for(const privateValue of ['111111','示例作者',prose,'示例作品 入学篇'])assert.ok(!serialized.includes(privateValue));
 assert.equal(report.documents[0].boundaryLines.length,8);
});
