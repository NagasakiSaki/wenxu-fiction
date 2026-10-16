// Synthetic, redistributable fixtures. Expected boundary lines are specified by
// the fixture author, independent of the engine's decisions.
const prose='雨水落在站台上，他收好信，走向最后一盏亮着的灯。'.repeat(8);
const fixture=(name,lines,expected)=>({name,text:lines.join('\n'),expected});
export const cases=[
 fixture('plain Chinese chapters',['第一章 雨',prose,'第二章 夜',prose],[1,3]),
 fixture('Markdown title and subordinate sections',['# 书名','## 第一章 雨',prose,'### 第一节 窗口',prose,'## 第二章 夜',prose],[2,6]),
 fixture('Word bold paragraph conversion',['**【第一章：雨】**',prose,'**【第二章：夜】**',prose],[1,3]),
 fixture('bracketed episodes',['【第1集】雨夜',prose,'【第2集】灯火',prose],[1,3]),
 fixture('English episodes',['Episode 1 Rain',prose,'EP. 2 Night',prose],[1,3]),
 fixture('narrative references and completion markers',['第一章 雨',prose,'第一章的事情已经过去。','(第一章完)','第二章 夜',prose],[1,5]),
 fixture('fenced sample headings',['第一章 雨',prose,'```md','# 第二章 假标题','```','第二章 夜',prose],[1,6]),
 fixture('repeated unnumbered Markdown level',['# 小说','## 雨',prose,'### 场景',prose,'## 夜',prose],[2,6]),
 fixture('bare Arabic sequence with prose',['1、雨','',prose,'','2、夜','',prose,'','3、信','',prose],[1,5,9]),
 fixture('bare Chinese sequence with prose',['一、雨','',prose,'','二、夜','',prose,'','三、信','',prose],[1,5,9]),
 fixture('short outline is not a novel',['1、人物','','姓名','','2、场景','','雨夜','','3、道具','','信'],[]),
 fixture('known limitation: unnumbered plain titles',['雨夜','',prose,'','灯火','',prose,'','来信','',prose],[1,5,9]),
];
