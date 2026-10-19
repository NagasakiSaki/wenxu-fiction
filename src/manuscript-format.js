import {refreshSections} from './chapter-hierarchy.js';

/** Whitespace-only edits; fenced/indented code and Markdown hard breaks are protected. */
export function formatChapter(chapter, {collapseBlank=true, trimTrailing=true}={}) {
 const before=String(chapter.body||'');
 const lines=before.match(/[^\n]*\n|[^\n]+$/g)||[];
 let offset=0, fence=null, blanks=0, htmlBlock=false;
 const edits=[];
 for(const raw of lines){
  const hasNewline=raw.endsWith('\n');
  const line=hasNewline?raw.slice(0,-1):raw;
  const clean=line.replace(/\r$/, '');
  const marker=clean.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if(/^ {0,3}<(pre|script|style|textarea)(?:\s|>)/i.test(clean))htmlBlock=true;
  const protectedLine=htmlBlock||!!fence||/^ {4}|^\t|^ {0,3}</.test(clean);
  if(marker){if(!fence)fence={char:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;}
  let next=clean;
  if(!protectedLine&&!marker){
   if(!clean.trim()) {blanks++;next=collapseBlank&&blanks>1?null:(trimTrailing?'':clean);}
   else {blanks=0;if(trimTrailing&&!/ {2,}$/.test(clean))next=clean.replace(/[\t ]+$/,'');}
  }else blanks=0;
  const replacement=next===null?'':next+(hasNewline?'\n':'');
  if(replacement!==raw)edits.push({start:offset,end:offset+raw.length,text:replacement});
  offset+=raw.length;
  if(/<\/(pre|script|style|textarea)>/i.test(clean))htmlBlock=false;
 }
 // Narrow edits to changed whitespace, then map anchors in one pass (linear in text size).
 const narrowed=edits.map(edit=>{
  let {start,end,text}=edit;
  let prefix=0,suffix=0;
  while(start+prefix<end&&prefix<text.length&&before[start+prefix]===text[prefix])prefix++;
  while(end-suffix>start+prefix&&text.length-suffix>prefix&&before[end-1-suffix]===text[text.length-1-suffix])suffix++;
  return {start:start+prefix,end:end-suffix,text:text.slice(prefix,text.length-suffix)};
 });
 const parts=[];let cursor=0;
 for(const edit of narrowed){parts.push(before.slice(cursor,edit.start),edit.text);cursor=edit.end;}
 parts.push(before.slice(cursor));const body=parts.join('');
 const points=[];let editIndex=0,delta=0;
 const original=[...new Set(chapter.pendingBreakpoints||[])].filter(p=>Number.isInteger(p)&&p>0&&p<before.length).sort((a,b)=>a-b);
 for(const point of original){
  while(editIndex<narrowed.length&&narrowed[editIndex].end<=point){const e=narrowed[editIndex++];delta+=e.text.length-(e.end-e.start);}
  const current=narrowed[editIndex];
  if(current&&point>current.start&&point<current.end)continue;
  const mapped=point+delta;
  if(mapped>0&&mapped<body.length&&!(/[\uD800-\uDBFF]/.test(body[mapped-1])&&/[\uDC00-\uDFFF]/.test(body[mapped]))&&points.at(-1)!==mapped)points.push(mapped);
 }
 const next=refreshSections({...chapter,body});
 if(points.length)next.pendingBreakpoints=points;else delete next.pendingBreakpoints;
 return {chapter:next,changed:body!==before,edits:edits.length,removedBreakpoints:(chapter.pendingBreakpoints?.length||0)-points.length};
}
export function formatManuscript(chapters, options){
 const results=chapters.map(c=>formatChapter(c,options));
 return {chapters:results.map(r=>r.chapter),changes:results.flatMap((r,index)=>r.changed?[{index,edits:r.edits,removedBreakpoints:r.removedBreakpoints}]:[])};
}
