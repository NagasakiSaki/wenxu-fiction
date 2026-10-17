import {learnHeadingProfile,validateHeadingProfile,matchesHeadingProfile} from './heading-profile.js';
import {findContents,advancedStructure} from './structure-intelligence.js';
import {inferNumberedHeadings,structureEvidence} from './structure-evidence.js';
// Analyse the whole document before selecting boundaries. Markdown heading level
// alone is not sufficient: a novel can have a title, subtitle and chapter outlines.
function heading(line){
 const match=line.trim().match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
 let text=match?match[2]:line.trim();
 const decorated=/^(\*{1,2}|_{1,2})([\s\S]+)\1$/.test(text);
 text=text.replace(/^(\*{1,2}|_{1,2})([\s\S]+)\1$/,'$2').trim();
 // Some TXT exporters keep brackets only around the number, e.g. 【第12集】雨夜.
 text=text.replace(/^【(第[^】]+)】\s*(.+)$/,'$1：$2');
 const pairs=[['【','】'],['[',']'],['（','）'],['(',')'],['「','」']];
 for(let i=0;i<3;i++){const pair=pairs.find(([a,b])=>text.startsWith(a)&&text.endsWith(b));if(!pair)break;text=text.slice(pair[0].length,-pair[1].length).trim();}
 return {text,level:match?match[1].length:0,decorated};
}
function chapterKind(item){
 const {text,level}=item;if(!text||text.length>100)return '';
 const cn=text.normalize('NFKC').match(/^第\s*[零〇一二三四五六七八九十百千万两\d]+\s*([章节回集幕话篇卷部])([\s\S]*)$/);
 if(cn){if(/^(?:的|完(?:结|本|\s|[\/／（(]|$)|结束|终了|[-–—~～至到]\s*第?\s*[\d一二三四五六七八九十])/.test(cn[2].trim()))return '';
  if(!level&&/[。；;]$/.test(text))return '';
  return ['卷','部'].includes(cn[1])?'volume':cn[1]==='节'?'section':'chapter';}
 if(/^(?:volume|part)\s*(?:\d+|[ivxlcdm]+)\b/i.test(text))return 'volume';
 if(/^(?:section)\s*\d+\b/i.test(text))return 'section';
 if(/^(?:chapter|episode|ep\.?)\s*(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(text)&&!/(?:\bend|complete)\s*$/i.test(text))return 'chapter';
 if(/^(序章|楔子|序言|前言|尾声|终章|后记|番外|prologue|epilogue)(?:\s|[：:、]|$)/i.test(text))return 'special';
 return '';
}
const separator=line=>/^\s*(?:[-*_=·─━]\s*){3,}\s*$/.test(line);
const meaningful=text=>text.split('\n').some(line=>line.trim()&&!separator(line));
export function analyseChapters(input,{fallbackTitle='序言',boundaryLines,profile,positiveLines,negativeLines=[]}={}){
 const lines=String(input).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 const items=lines.map((line,index)=>{const h=heading(line);return {...h,index,kind:chapterKind(h)};});
 // Never interpret headings or apparent chapter names inside fenced code as boundaries.
 let fence=null;for(const item of items){const m=lines[item.index].trim().match(/^(`{3,}|~{3,})/);if(m){if(!fence)fence=m[1];else if(m[1][0]===fence[0]&&m[1].length>=fence.length)fence=null;item.kind='';item.level=0;item.fenced=true;}else if(fence){item.kind='';item.level=0;item.fenced=true;}}
 const contents=findContents(items,lines),activeItems=items.filter(h=>!contents.excluded.has(h.index));
 if(positiveLines!==undefined){if(positiveLines.some(n=>items[n-1]?.fenced))throw Error('代码块内不能作为标题示例');profile=learnHeadingProfile(lines,positiveLines,negativeLines);}
 if(profile)validateHeadingProfile(profile);
 const learned=profile?activeItems.filter(h=>!h.fenced&&h.text.length<=100&&matchesHeadingProfile(lines[h.index],profile)&&(h.index===0||!lines[h.index-1].trim()||h.level||positiveLines?.includes(h.index+1))&&lines.slice(h.index+1,h.index+5).some(line=>line.trim())).map(h=>({...h,kind:'learned'})):[];
 const explicit=activeItems.filter(h=>h.kind==='chapter');
 const secondary=activeItems.filter(h=>h.kind==='section');
 const inferred=explicit.length||secondary.length?[]:inferNumberedHeadings(activeItems,lines);
 const primary=learned.length?learned:explicit.length?explicit:secondary.length?secondary:inferred;
 let boundaries=[],method='整篇文档';
 if(primary.length){
  const levels=primary.filter(h=>h.level).map(h=>h.level),level=levels.length?Math.min(...levels):6;
  const primarySet=new Set(primary.map(h=>h.index));boundaries=activeItems.filter(h=>primarySet.has(h.index)||(h.kind==='special'&&(!h.level||h.level<=level)));
  method=learned.length?'本书示例学习':explicit.length?'明确章节标题':secondary.length?'编号分节标题':'连续编号与正文结构推断';
 }else{
  const specials=activeItems.filter(h=>h.kind==='special');
  if(specials.length){boundaries=specials;method='序章与尾声标题';}
  else{
   const candidates=activeItems.filter(h=>h.level&&h.text.length<=100&&!/^(?:【?本章|主视角|人物设定|章节大纲)/.test(h.text));
   // Prefer a common structural level; title/subtitle levels that occur only once
   // must not become independent chapters when repeated deeper headings exist.
   const repeated=[1,2,3,4,5,6].find(level=>candidates.filter(h=>h.level===level).length>1);
   const level=repeated||candidates[0]?.level;
   boundaries=candidates.filter(h=>h.level===level);method=boundaries.length?'Markdown 同级标题':'整篇文档';
  }
 }
 if(boundaryLines!==undefined){
  if(!Array.isArray(boundaryLines)||boundaryLines.length>1000||new Set(boundaryLines).size!==boundaryLines.length)throw Error('分界行必须唯一，且不超过1000个');
  boundaries=boundaryLines.map(line=>{if(!Number.isInteger(line)||line<1||line>lines.length)throw Error('分界行超出文档范围');const item=items[line-1];if(!item.text||item.text.length>100||item.fenced||separator(item.text))throw Error('请选择100字以内的非空标题行，代码和分隔线不能作为标题');return item;}).sort((a,b)=>a.index-b.index);method='作者校正分界';
 }
 if(boundaries.length>1000)throw Error('识别分界超过1000个，请拆分文档后导入');
 const structureOnly=new Set([...contents.excluded,...(boundaries.length?activeItems.filter(h=>h.kind==='volume').map(h=>h.index):[])]),bodyLines=new Set();
 const chapters=[],frontMatter=[];let title='',subtitle='';
 const first=boundaries[0]?.index??lines.length;
 // Only remove title/subtitle headings before the first selected chapter.
 // Preserve all actual introductory prose as a preface chapter.
 const prefix=lines.slice(0,first);const prefixItems=items.filter(h=>h.index<first&&h.text&&!separator(h.text));
 const titleHeading=prefixItems.find(h=>h.level===1&&!h.kind);
 const metadataIndices=new Set();
 if(titleHeading){title=titleHeading.text;metadataIndices.add(titleHeading.index);for(const h of items.filter(h=>h.index>titleHeading.index&&h.index<first&&h.level>1&&!h.kind)){subtitle+=(subtitle?'\n':'')+h.text;metadataIndices.add(h.index);}}
 const metadataLine=line=>{const clean=line.replace(/^\s*>\s?/,'').replace(/\*\*|__/g,'').trim();return /^(?:【[^】]{1,80}】|(?:书名|作者|原作背景|卷名|本篇体量|篇幅体量|内容体量|核心主旨|四大卷目|献礼巨著|简介|内容简介|文案)\s*[：:])/.test(clean);};
 if(boundaries.length){
  const firstText=prefixItems[0];
  if(!title&&firstText&&!firstText.kind&&firstText.text.length<=120&&!/[。！？!?]$/.test(firstText.text)&&
    (firstText.decorated||/^《.+》/.test(firstText.text)||prefixItems.slice(1).some(h=>/^——/.test(h.text)||metadataLine(h.text)))){title=firstText.text;metadataIndices.add(firstText.index);}
  if(title){for(const h of prefixItems){if(/^——/.test(h.text)){if(!metadataIndices.has(h.index))subtitle+=(subtitle?'\n':'')+h.text;metadataIndices.add(h.index);}else if(metadataLine(lines[h.index]))metadataIndices.add(h.index);}}
 }
 const prose=prefix.filter((_,index)=>!metadataIndices.has(index)&&!structureOnly.has(index));
 if(metadataIndices.size)frontMatter.push(...prefix.filter((_,index)=>metadataIndices.has(index)));
 if(meaningful(prose.join('\n'))&&boundaries.length){chapters.push({title:'序言',body:prose.join('\n').trim(),sourceStartLine:1,sourceEndLine:first});for(let i=0;i<first;i++)if(!metadataIndices.has(i)&&!structureOnly.has(i))bodyLines.add(i);}
 if(boundaries.length){for(let i=0;i<boundaries.length;i++){
  const current=boundaries[i],end=boundaries[i+1]?.index??lines.length,body=lines.slice(current.index+1,end).filter((_,i)=>!structureOnly.has(current.index+1+i)).join('\n').trim();
  if(meaningful(body)){chapters.push({title:current.text,body,sourceStartLine:current.index+1,sourceEndLine:end});for(let j=current.index+1;j<end;j++)if(!structureOnly.has(j))bodyLines.add(j);}
 }}else if(meaningful(input)){chapters.push({title:fallbackTitle,body:lines.join('\n').trim(),sourceStartLine:1,sourceEndLine:lines.length});for(let i=0;i<lines.length;i++)bodyLines.add(i);}
 // A heading-only document is not a readable chapter.
 const producedHeadings=new Set(boundaries.filter(h=>chapters.some(c=>c.sourceStartLine===h.index+1)).map(h=>h.index));
 const archivedLines=lines.flatMap((_,i)=>!bodyLines.has(i)&&!producedHeadings.has(i)?[i]:[]);
 const evidence=structureEvidence({items,lines,boundaries,chapters,method,inferred,manual:boundaryLines!==undefined});
 return {chapters,title,subtitle,archivedLines,frontMatter:archivedLines.map(i=>lines[i]).join('\n').trim(),method,...evidence,...advancedStructure({items,lines,chapters,boundaries,evidence,archivedLines,contents,profile})};
}
