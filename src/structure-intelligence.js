import {matchesHeadingProfile} from './heading-profile.js';
const compact=s=>s.replace(/\s/g,'');
const key=s=>s.normalize('NFKC').replace(/\s*(?:[.…·]{2,}\s*)?\d+\s*$/,'').replace(/\s/g,'').toLowerCase();
export function findContents(items,lines){
 const marker=items.find(h=>!h.fenced&&h.index<Math.min(300,lines.length*.4)&&/^(?:目\s*录|contents|table of contents)$/i.test(h.text));if(!marker)return {excluded:new Set(),matches:[]};
 const occurrences=new Map();for(const h of items)if(!h.fenced&&(h.kind||h.level)){const k=key(h.text);if(!occurrences.has(k))occurrences.set(k,[]);occurrences.get(k).push(h);}
 const entries=[];let last=marker.index;
 for(const h of items){if(h.index<=marker.index)continue;if(h.index-marker.index>3000)break;if(!h.text)continue;
  const group=occurrences.get(key(h.text));const later=group?.find(other=>other.index>h.index+1);
  if(!(h.kind||h.level)||!later||compact(lines.slice(last+1,h.index).join('')).length>40)break;
  entries.push({line:h.index+1,bodyLine:later.index+1,title:h.text});last=h.index;
 }
 if(entries.length<2)return {excluded:new Set(),matches:[]};
 const excluded=new Set(Array.from({length:last-marker.index+1},(_,i)=>marker.index+i));return {excluded,matches:entries};
}
export function advancedStructure({items,lines,chapters,boundaries,evidence,archivedLines,contents,profile}){
 const candidates=evidence.candidates.map(c=>({...c,evidence:[...c.evidence],needsReview:c.confidence==='需核对'})),byLine=new Map(candidates.map(c=>[c.line,c]));
 // Index the next nonempty line once; long manuscripts stay linear here.
 const next=new Array(lines.length);let following=-1;for(let i=lines.length-1;i>=0;i--){next[i]=following;if(lines[i].trim())following=i;}
 for(const h of items){if(h.fenced||contents.excluded.has(h.index)||!h.text||h.text.length>60)continue;
  const n=next[h.index],isolated=h.index===0||!lines[h.index-1].trim(),proseAfter=n>=0&&compact(lines[n]).length>=24;
  if(!byLine.has(h.index+1)&&isolated&&proseAfter&&!/[。！？!?；;：:]$/.test(h.text)&&!/^[-*_=`~]{3}/.test(h.text)){
   const c={line:h.index+1,title:h.text,kind:'possible',selected:false,confidence:'需核对',needsReview:true,evidence:['独立短行','后接正文；也可能是场景或小标题，不自动切分']};if(candidates.length<5000){candidates.push(c);byLine.set(c.line,c);}
  }
 }
 for(const m of contents.matches){const c=byLine.get(m.line);if(c){c.selected=false;c.kind='contents';c.needsReview=false;c.confidence='目录已归档';c.evidence.push(`与正文第 ${m.bodyLine} 行匹配；目录原文留在导入资料`);}}
 const diagnostics=[...evidence.diagnostics];
 const lengths=chapters.map(c=>compact(c.body).length).sort((a,b)=>a-b),median=lengths[Math.floor(lengths.length/2)]||0;
 const seenTitles=new Map(),seenBodies=new Map();let volume=null;
 const volumes=items.filter(h=>h.kind==='volume'&&!h.fenced&&!contents.excluded.has(h.index));let v=0;
 const sections=items.filter(h=>h.kind==='section'&&!h.fenced&&!contents.excluded.has(h.index));let s=0;
 const sectionIndexes=new Set(sections.map(h=>h.index));
 const hierarchy=[],archiveForSections=new Set(archivedLines),boundarySet=new Set(boundaries.map(h=>h.index));
 for(let i=0;i<chapters.length;i++){
  const c=chapters[i];while(v<volumes.length&&volumes[v].index<c.sourceStartLine){volume=volumes[v++];}
  if(volume)c.volume=volume.text;
  const paragraphByLine=new Map();let paragraph=0,seenBody=false,inGap=false;const bodyStart=boundarySet.has(c.sourceStartLine-1)?c.sourceStartLine:c.sourceStartLine-1;for(let j=bodyStart;j<c.sourceEndLine;j++){if(archiveForSections.has(j))continue;if(!lines[j].trim()){if(seenBody&&!inGap)paragraph++;inGap=true;}else{if(sectionIndexes.has(j))paragraphByLine.set(j,paragraph);seenBody=true;inGap=false;}}
  c.sections=[];while(s<sections.length&&sections[s].index<c.sourceStartLine)s++;
  while(s<sections.length&&sections[s].index<c.sourceEndLine){const section=sections[s++];if(section.index+1===c.sourceStartLine)continue;c.sections.push({title:section.text,line:section.index+1,paragraph:paragraphByLine.get(section.index)||0});}
  hierarchy.push({chapter:i,line:c.sourceStartLine,volume:volume?.text||'',title:c.title,sections:c.sections});
  const length=compact(c.body).length;if(chapters.length>=4&&median>=80&&(length>median*3.5||length<median*.15))diagnostics.push({code:'relative-length',line:c.sourceStartLine,message:`「${c.title}」${length}字，明显偏离本书中位篇幅${median}字，请检查误切或漏切。`});
  const titleKey=(c.volume||'')+'\0'+c.title;if(seenTitles.has(titleKey))diagnostics.push({code:'duplicate-title',line:c.sourceStartLine,message:`同卷内标题重复，首次出现于第${seenTitles.get(titleKey)}行。`});seenTitles.set(titleKey,c.sourceStartLine);
  if(seenBodies.has(c.body))diagnostics.push({code:'duplicate-body',line:c.sourceStartLine,message:`正文与第${seenBodies.get(c.body)}行章节完全相同，请检查重复导入。`});seenBodies.set(c.body,c.sourceStartLine);
 }
 for(const d of diagnostics){const c=byLine.get(d.line);if(c&&!['empty-boundary'].includes(d.code)){c.needsReview=true;c.evidence.push(`全文体检：${d.code}`);}}
 const selected=new Set(boundaries.map(h=>h.index));for(const c of candidates){if(c.kind==='contents')continue;c.selected=selected.has(c.line-1);if(profile&&c.selected&&matchesHeadingProfile(lines[c.line-1],profile)){c.confidence='本书示例规则';c.evidence.push('匹配作者示例；需作者确认导入');c.needsReview=true;}}
 const archiveSet=new Set(archivedLines),headingSet=new Set(boundaries.filter(h=>chapters.some(c=>c.sourceStartLine===h.index+1)).map(h=>h.index));
 let covered=0,bodyCharacters=0,headingCharacters=0,archiveCharacters=0;const gaps=[];
 for(let i=0;i<lines.length;i++){const count=compact(lines[i]).length;if(!count)continue;if(archiveSet.has(i)){archiveCharacters+=count;covered+=count;}else if(headingSet.has(i)){headingCharacters+=count;covered+=count;}else gaps.push(i);}
 const actualBodies=compact(chapters.map(c=>c.body).join('')),expectedBodies=compact(gaps.map(i=>lines[i]).join(''));
 bodyCharacters=actualBodies.length;const sourceCharacters=compact(lines.join('')).length,bodyExact=chapters.every(c=>{const start=selected.has(c.sourceStartLine-1)?c.sourceStartLine:c.sourceStartLine-1;return lines.slice(start,c.sourceEndLine).filter((_,i)=>!archiveSet.has(start+i)).join('\n').trim()===c.body;}),ok=bodyExact&&actualBodies===expectedBodies&&covered+bodyCharacters===sourceCharacters;
 const integrity={ok,bodyExact,normalization:'去除BOM、统一换行；正文首尾空白规范化；标题格式单独记录',sourceCharacters,bodyCharacters,headingCharacters,archiveCharacters,unaccountedCharacters:ok?0:Math.abs(sourceCharacters-covered-bodyCharacters),archivedLineCount:archiveSet.size};
 if(!ok)diagnostics.push({code:'integrity-mismatch',line:1,message:'原文与正文/标题/归档资料的覆盖核对未通过，请保留源文件并检查，勿直接确认导入。'});
 return {candidates:candidates.sort((a,b)=>a.line-b.line),diagnostics,hierarchy,contentsMatches:contents.matches,integrity,profile:profile||null,metrics:{...evidence.metrics,reviewCount:diagnostics.length,uncertainCount:candidates.filter(c=>c.needsReview).length,volumeCount:volumes.length,sectionCount:sections.length,medianCharacters:median,candidateCount:candidates.length}};
}
