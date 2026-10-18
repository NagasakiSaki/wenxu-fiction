import {analyseImportedChapters as analyseChapters} from './import-analysis.js';
import {splitChapterAtPoints} from './chapter-edit.js';
import {auditWork} from './work-health.js';
export const normalizeSource=text=>String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
export function sourceIndex(text){const starts=[0];for(let i=0;i<text.length;i++)if(text[i]==='\n')starts.push(i+1);return starts;}
export function lineAtOffset(starts,offset){let low=0,high=starts.length;while(low+1<high){const mid=(low+high)>>1;if(starts[mid]<=offset)low=mid;else high=mid;}return low;}
export function sourcePages(text,size=12000){if(!Number.isInteger(size)||size<32||size>50000)throw Error('原文分段大小无效');const pages=[];let start=0;while(start<text.length){let end=Math.min(text.length,start+size);if(end<text.length){const newline=text.lastIndexOf('\n',end);if(newline>start+size/2)end=newline+1;if(/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;}pages.push({start,end});start=end;}return pages.length?pages:[{start:0,end:0}];}
export function analyseVisualPlan(input,options={}){
 const text=normalizeSource(input),plan=options.visualPlan;if(!plan||!Array.isArray(plan.headingLines)||!Array.isArray(plan.splitOffsets)||plan.splitOffsets.length>999)throw Error('原文分章方案无效');
 const offsets=[...plan.splitOffsets].sort((a,b)=>a-b);if(new Set(offsets).size!==offsets.length)throw Error('这个断点已存在');
 const base=analyseChapters(text,{...options,boundaryLines:plan.headingLines}),lines=text.split('\n'),starts=sourceIndex(text),archived=new Set(base.archivedLines||[]),headings=new Set(base.boundaryLines.map(n=>n-1)),positions=new Map();
 for(const offset of offsets){if(!Number.isInteger(offset)||offset<=0||offset>=text.length)throw Error('请在正文内部选择断点');if(/[\uD800-\uDBFF]/.test(text[offset-1])&&/[\uDC00-\uDFFF]/.test(text[offset]))throw Error('断点不能在一个字符内部');positions.set(lineAtOffset(starts,offset),[]);}
 offsets.forEach(offset=>positions.get(lineAtOffset(starts,offset)).push(offset));
 const groups=base.chapters.map(()=>[]),mapped=new Set();
 base.chapters.forEach((c,index)=>{
  const first=headings.has(c.sourceStartLine-1)?c.sourceStartLine:c.sourceStartLine-1,kept=[];let rawLength=0,leading=0,found=false;
  for(let i=first;i<c.sourceEndLine;i++){if(archived.has(i))continue;if(kept.length)rawLength++;const line=lines[i];if(!found){const m=line.match(/\S/);if(m){leading=rawLength+m.index;found=true;}}
   kept.push(i);for(const absolute of positions.get(i)||[]){groups[index].push({absolute,offset:rawLength+absolute-starts[i]});mapped.add(absolute);}rawLength+=line.length;
  }
  for(const point of groups[index]){point.offset-=leading;if(point.offset<=0||point.offset>=c.body.length)throw Error('该位置已是章节起止处，或属于首尾空白；请在正文中间选点');}
 });
 if(mapped.size!==offsets.length)throw Error('标题或归档资料不能作为正文断点，请选正文位置；标题请使用“设为标题”');
 let chapters=base.chapters.map(c=>({...c,sourceStartOffset:starts[c.sourceStartLine-1],sourceEndOffset:starts[c.sourceEndLine]??text.length}));
 for(let i=base.chapters.length-1;i>=0;i--){const points=groups[i];if(!points.length)continue;const original=chapters[i];chapters=splitChapterAtPoints(chapters,i,points.map(p=>p.offset));const cuts=[original.sourceStartOffset,...points.map(p=>p.absolute),original.sourceEndOffset];for(let n=0;n<cuts.length-1;n++)chapters[i+n]={...chapters[i+n],sourceStartOffset:cuts[n],sourceEndOffset:cuts[n+1],sourceStartLine:lineAtOffset(starts,cuts[n])+1,sourceEndLine:n===cuts.length-2?original.sourceEndLine:lineAtOffset(starts,cuts[n+1])+1};}
 const preserved=chapters.map(c=>c.body).join('')===base.chapters.map(c=>c.body).join(''),audit=auditWork(chapters),diagnostics=[...base.diagnostics.filter(d=>!['short-body','long-body','relative-length','duplicate-body','duplicate-title'].includes(d.code)),...audit.issues.map(d=>({code:d.code,line:chapters[d.chapter].sourceStartLine,message:d.message}))];
 return {...base,chapters,method:'原文点选分章',visualPlan:{headingLines:[...base.boundaryLines],splitOffsets:offsets},integrity:{...base.integrity,ok:base.integrity.ok&&preserved,bodyExact:base.integrity.bodyExact&&preserved},diagnostics,hierarchy:chapters.map((c,i)=>({chapter:i,line:c.sourceStartLine,title:c.title,volume:c.volume||'',sections:c.sections||[]})),metrics:{...base.metrics,chapterCount:chapters.length,reviewCount:diagnostics.length,manualBreakCount:offsets.length}};
}
