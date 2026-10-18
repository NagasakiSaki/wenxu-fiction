import {analyseChapters} from './chapter-analysis.js';
import {inspectSerialPosts,serialPlan,withSerialVolumes} from './forum-serial.js';
import {tidyText} from './text-tidy.js';

// Keep original line coordinates for file import and precise source-cursor review.
// Site metadata is archived, never silently discarded from the imported document.
export function analyseImportedChapters(input,options={}){
 const text=String(input).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),raw=text.split('\n');
 if(options.forumSerial===false)return {...analyseChapters(text,options),forumSerial:false};
 const probe=tidyText(text).text.split('\n'),inspection=inspectSerialPosts(probe,raw);
 if(!inspection.recognized)return analyseChapters(text,options);
 const sourceLines=raw.map((_,i)=>i+1),serial={recognized:true,posts:inspection.posts,sourceLines,...serialPlan(probe,inspection.posts,sourceLines,{metadataLines:new Set([...inspection.metadata.keys()].map(i=>i+1))})};
 const boundaryLines=options.boundaryLines??(options.profile||options.positiveLines?undefined:serial.headings);
 const analysis=analyseChapters(text,{...options,boundaryLines,archiveLines:[...new Set([...(options.archiveLines||[]),...serial.arcs.filter(a=>!boundaryLines?.includes(a.line)).map(a=>a.line),...[...inspection.metadata.keys()].map(i=>i+1)])]});
 const chapters=withSerialVolumes(analysis.chapters,serial);
 const risks=new Map(serial.roles.filter(r=>r.needsReview||r.kind==='repeat').map(r=>[r.line,r]));
 const candidates=analysis.candidates.map(c=>{const role=risks.get(c.line);return {...c,needsReview:!!role||!!(options.profile||options.positiveLines)&&c.needsReview,evidence:role?[...c.evidence,role.message]:c.evidence};});
 const resets=new Set(serial.roles.filter(r=>r.kind==='start'&&r.volume&&r.number<=1).map(r=>r.line));
 return {...analysis,chapters,serial,method:options.boundaryLines!==undefined?analysis.method:'论坛连载整理',
  diagnostics:[...analysis.diagnostics.filter(d=>!(resets.has(d.line)&&['sequence-gap','repeated-number'].includes(d.code))),
   ...serial.roles.filter(r=>r.needsReview||r.kind==='repeat').map(r=>({code:'serial-'+r.kind,line:r.line,message:r.message}))],
  candidates,
  metrics:{...analysis.metrics,serialPosts:inspection.posts.length,uncertainCount:candidates.filter(c=>c.needsReview).length,volumeCount:new Set(chapters.map(c=>c.volume).filter(Boolean)).size},
  hierarchy:analysis.hierarchy.map(h=>({...h,volume:chapters[h.chapter]?.volume||h.volume}))};
}
