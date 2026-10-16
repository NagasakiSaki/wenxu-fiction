import {headingNumber} from './chapter-numbers.js';

// Conservative inference: numbering alone is not enough to distinguish a chapter
// from an outline. Require repeated isolated headings, sequence and prose spans.
export function inferNumberedHeadings(items,lines){
 const possible=items.filter(h=>!h.fenced&&!h.kind&&!h.level&&h.text.length<=60&&/^[零〇一二两三四五六七八九十百千万\d]+[、.．\s]+\S/.test(h.text.normalize('NFKC'))&&!/[。！？!?；;]$/.test(h.text)&&(!lines[h.index-1]?.trim()||!lines[h.index+1]?.trim()));
 if(possible.length<3)return [];
 let ascending=0,prose=0;
 for(let i=0;i<possible.length;i++){if(i&&headingNumber(possible[i].text)===headingNumber(possible[i-1].text)+1)ascending++;const end=possible[i+1]?.index??lines.length;if(lines.slice(possible[i].index+1,end).join('').replace(/\s/g,'').length>=80)prose++;}
 if(ascending/(possible.length-1)<.8||prose/possible.length<.8)return [];
 return possible.map(h=>({...h,kind:'inferred'}));
}
export function structureEvidence({items,lines,boundaries,chapters,method,inferred=[],manual=false}){
 const selected=new Set(boundaries.map(h=>h.index));const inferredSet=new Set(inferred.map(h=>h.index));
 const candidates=items.filter(h=>!h.fenced&&h.text&&h.text.length<=100&&(h.kind||h.level||inferredSet.has(h.index)||selected.has(h.index))).map(h=>({line:h.index+1,title:h.text,kind:inferredSet.has(h.index)?'inferred':h.kind||(h.level?'markdown':'manual'),selected:selected.has(h.index),confidence:inferredSet.has(h.index)?'结构推断':h.kind==='chapter'?'明确标题':'需核对',evidence:[...(h.kind?['匹配章节语义']:[]),...(h.level?[`Markdown H${h.level} / Word 标题样式`]:[]),...(h.decorated?['加粗或强调格式']:[]),...(inferredSet.has(h.index)?['连续编号达标','独立成行','相邻正文长度达标']:[]),...(selected.has(h.index)?[manual?'作者手动选择':method]:['保留在正文或书前资料，不自动切分'])]}));
 const diagnostics=[];let last=null;const seen=new Map();
 for(const h of boundaries){const num=headingNumber(h.text);if(num===null)continue;
  const volumeBetween=last&&items.slice(last.index+1,h.index).some(item=>item.kind==='volume');
  if(last&&!volumeBetween&&num!==last.num+1)diagnostics.push({code:num===last.num?'repeated-number':'sequence-gap',line:h.index+1,message:`章节编号 ${last.num} → ${num}，请确认是否缺章、重复或卷内重编号。`});
  if(seen.has(h.text))diagnostics.push({code:'duplicate-heading',line:h.index+1,message:`与第 ${seen.get(h.text)} 行标题相同，可能是目录与正文重复；不会自动删除内容。`});
  seen.set(h.text,h.index+1);last={...h,num};
 }
 for(const c of chapters){const length=c.body.replace(/\s/g,'').length;if(length<80)diagnostics.push({code:'short-body',line:c.sourceStartLine,message:`「${c.title}」正文不足80字，建议核对目录、误切和短章。`});if(length>40000)diagnostics.push({code:'long-body',line:c.sourceStartLine,message:`「${c.title}」超过4万字，可能有未识别的标题，可按原文行号补充分界。`});}
 const produced=new Set(chapters.map(c=>c.sourceStartLine));for(const h of boundaries)if(!produced.has(h.index+1))diagnostics.push({code:'empty-boundary',line:h.index+1,message:`「${h.text}」后没有可阅读正文，未生成空章。`});
 if(!boundaries.length)diagnostics.push({code:'no-boundary',line:1,message:manual?'当前未选择分界，按整篇导入。':'没有足够可靠的分章依据，按整篇导入；可手动添加标题行。'});
 return {candidates,diagnostics,boundaryLines:boundaries.map(h=>h.index+1),metrics:{sourceLines:lines.length,sourceCharacters:lines.join('\n').length,candidateCount:candidates.length,chapterCount:chapters.length,reviewCount:diagnostics.length}};
}
