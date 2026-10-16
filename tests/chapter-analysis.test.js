import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseChapters} from '../src/chapter-analysis.js';
test('book title/subtitle and separators are metadata; bracketed chapter headings define five chapters',()=>{
 const chapters=Array.from({length:5},(_,i)=>`### 【第${i+1}章：章节标题${i+1}！】\n**主视角：角色**\n\n#### 【本章大纲】\n1. 大纲条目。\n\n---\n\n第${i+1}章的正文。\n\n#### 第二节：章内小节\n小节正文。\n\n---\n*(第${i+1}章完 / 角色视角)*\n*(字数：约3000字)*\n\n---`);
 const source='# 《测试书名》\n## ——故事副标题\n\n---\n\n'+chapters.join('\n\n');
 const result=analyseChapters(source);assert.equal(result.title,'《测试书名》');assert.equal(result.subtitle,'——故事副标题');assert.equal(result.chapters.length,5);assert.equal(result.method,'明确章节标题');assert.equal(result.chapters[0].sourceStartLine,6);
 for(let i=0;i<5;i++){const c=result.chapters[i];assert.equal(c.title,`第${i+1}章：章节标题${i+1}！`);assert.match(c.body,/本章大纲/);assert.match(c.body,/主视角/);assert.match(c.body,/章完/);assert.match(c.body,/第二节：章内小节/);const lines=source.split('\n');assert.equal(c.body,lines.slice(c.sourceStartLine,c.sourceEndLine).join('\n').trim());}
});
test('explicit headings work without Markdown and support bold/bracket decoration',()=>{const r=analyseChapters('书前说明。\n\n【第一章：开始】\n内容甲\n**【第二章：后来】**\n内容乙\n*(第2章完)*');assert.equal(r.chapters.length,3);assert.equal(r.chapters[0].title,'序言');assert.equal(r.chapters[1].title,'第一章：开始');assert.match(r.chapters[2].body,/第2章完/);});
test('chapter priority prevents subsection or unrelated headings from creating chapters',()=>{const r=analyseChapters('# 我的小说\n## 简介副标题\n### 第一章 开始\n甲\n#### 本章大纲\n大纲\n## 随想\n想法\n### 第二章 之后\n乙');assert.equal(r.chapters.length,2);assert.match(r.chapters[0].body,/## 随想/);});
test('without numbered chapters uses repeated Markdown level, not book title or subsection',()=>{const r=analyseChapters('# 书名\n## 雨夜\n正文甲\n### 场景一\n细节\n## 黎明\n正文乙');assert.equal(r.title,'书名');assert.deepEqual(r.chapters.map(c=>c.title),['雨夜','黎明']);assert.match(r.chapters[0].body,/场景一/);});
test('fenced code and sentence references do not create chapter boundaries',()=>{const r=analyseChapters('第一章 开始\n正文。\n```md\n# 第二章 假标题\n```\n第一章的内容已经结束。\n第二章 后续\n正文。');assert.equal(r.chapters.length,2);assert.match(r.chapters[0].body,/# 第二章 假标题/);});
test('separator-only documents are empty; heading-free documents use filename',()=>{assert.equal(analyseChapters('---\n\n***').chapters.length,0);assert.equal(analyseChapters('一段正文。',{fallbackTitle:'文件名'}).chapters[0].title,'文件名');});
