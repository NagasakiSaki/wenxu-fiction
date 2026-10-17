// Deterministic length guidance, not plot/semantic understanding. Never hard-cut
// arbitrary characters: choose a paragraph boundary or a sentence ending.
export function suggestBreaks(text,target=3000,{strategy='length'}={}){
 if(!['length','scene'].includes(strategy))throw Error('断点建议模式无效');
 if(!Number.isInteger(target)||target<200||target>20000)throw Error('目标字数需为200–20000的整数');
 const candidates=new Map();for(const match of text.matchAll(/\n[ \t]*\n+/g))candidates.set(match.index+match[0].length,'段落');
 for(const match of text.matchAll(/[。！？!?][”’」』】）)]*(?:\s*)/g)){const at=match.index+match[0].length;if(!candidates.has(at))candidates.set(at,'句末');}
 if(strategy==='scene'){
  for(const match of text.matchAll(/(?:^|\n)[ \t]*(?:[＊*·—─=][ \t]*){3,}[^\S\n]*(?:\n|$)/g))candidates.set(match.index+match[0].length,'场景分隔符');
  for(const match of text.matchAll(/(?:^|\n[ \t]*\n+)(?=(?:翌日|次日|第二天|数日后|多年后|几小时后|与此同时|另一边|同一时刻|当天(?:清晨|傍晚|深夜)|(?:清晨|傍晚|深夜)[，,。]))/g))candidates.set(match.index+match[0].length,'时间或视角转场词');
 }
 const options=[...candidates].filter(([offset])=>offset>0&&offset<text.length).sort((a,b)=>a[0]-b[0]),points=[];let start=0,cursor=0,limited=false;
 while(text.length-start>target*1.35){
  const min=start+Math.max(80,Math.floor(target*.65)),max=start+Math.floor(target*1.35);while(cursor<options.length&&options[cursor][0]<min)cursor++;
  let best=null;for(let i=cursor;i<options.length&&options[i][0]<=max;i++){const [offset,type]=options[i],score=Math.abs(offset-start-target)/target+(type==='段落'?0:['场景分隔符','时间或视角转场词'].includes(type)?-.35:.18);if(!best||score<best.score)best={offset,type,score};}
  if(!best){const next=options[cursor];if(!next)break;best={offset:next[0],type:next[1]};}
  if(text.length-best.offset<Math.max(80,target*.35))break;
  if(points.length===999){limited=true;break;}points.push({offset:best.offset,type:best.type,characters:best.offset-start});start=best.offset;
 }
 return {points,limited,message:points.length?(strategy==='scene'?'依据篇幅、分隔符和转场词建议；不代表理解情节，请逐项确认。':'建议只依据篇幅与段落/句末位置，请核对情节后确认。'):'没有适合的自然断点，或篇幅不足；可手动标记断点。'};
}
