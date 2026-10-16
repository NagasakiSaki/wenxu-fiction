// Analyse the whole document before selecting boundaries. Markdown heading level
// alone is not sufficient: a novel can have a title, subtitle and chapter outlines.
function heading(line){
 const match=line.trim().match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
 let text=match?match[2]:line.trim();
 text=text.replace(/^(\*\*|__)([\s\S]+)\1$/,'$2').trim();
 const pairs=[['【','】'],['[',']'],['（','）'],['(',')'],['「','」']];
 for(let i=0;i<3;i++){const pair=pairs.find(([a,b])=>text.startsWith(a)&&text.endsWith(b));if(!pair)break;text=text.slice(pair[0].length,-pair[1].length).trim();}
 return {text,level:match?match[1].length:0};
}
function chapterKind(item){
 const {text,level}=item;if(!text||text.length>100)return '';
 const cn=text.normalize('NFKC').match(/^第\s*[零〇一二三四五六七八九十百千万两\d]+\s*([章节回卷部])([\s\S]*)$/);
 if(cn){if(/^(?:的|完(?:\s|[\/／（(]|$)|结束|终了)/.test(cn[2].trim()))return '';
  if(!level&&/[。；;]$/.test(text))return '';
  return ['章','回'].includes(cn[1])?'chapter':cn[1]==='节'?'section':'volume';}
 if(/^chapter\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(text)&&!/(?:\bend|complete)\s*$/i.test(text))return 'chapter';
 if(/^(序章|楔子|序言|前言|尾声|终章|后记|番外|prologue|epilogue)(?:\s|[：:、]|$)/i.test(text))return 'special';
 return '';
}
const meaningful=text=>text.split('\n').some(line=>line.trim()&&!/^\s*(?:[-*_]\s*){3,}\s*$/.test(line));
export function analyseChapters(input,{fallbackTitle='序言'}={}){
 const lines=String(input).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 const items=lines.map((line,index)=>{const h=heading(line);return {...h,index,kind:chapterKind(h)};});
 // Never interpret headings or apparent chapter names inside fenced code as boundaries.
 let fence=null;for(const item of items){const m=lines[item.index].trim().match(/^(`{3,}|~{3,})/);if(m){if(!fence)fence=m[1];else if(m[1][0]===fence[0]&&m[1].length>=fence.length)fence=null;item.kind='';item.level=0;}else if(fence){item.kind='';item.level=0;}}
 const explicit=items.filter(h=>h.kind==='chapter');
 const secondary=items.filter(h=>h.kind==='section');
 const primary=explicit.length?explicit:secondary;
 let boundaries=[],method='整篇文档';
 if(primary.length){
  const levels=primary.filter(h=>h.level).map(h=>h.level),level=levels.length?Math.min(...levels):6;
  boundaries=items.filter(h=>primary.includes(h)||(h.kind==='special'&&(!h.level||h.level<=level)));
  method=explicit.length?'明确章节标题':'编号分节标题';
 }else{
  const specials=items.filter(h=>h.kind==='special');
  if(specials.length){boundaries=specials;method='序章与尾声标题';}
  else{
   const candidates=items.filter(h=>h.level&&h.text.length<=100&&!/^(?:【?本章|主视角|人物设定|章节大纲)/.test(h.text));
   // Prefer a common structural level; title/subtitle levels that occur only once
   // must not become independent chapters when repeated deeper headings exist.
   const repeated=[1,2,3,4,5,6].find(level=>candidates.filter(h=>h.level===level).length>1);
   const level=repeated||candidates[0]?.level;
   boundaries=candidates.filter(h=>h.level===level);method=boundaries.length?'Markdown 同级标题':'整篇文档';
  }
 }
 const chapters=[],frontMatter=[];let title='',subtitle='';
 const first=boundaries[0]?.index??lines.length;
 // Only remove title/subtitle headings before the first selected chapter.
 // Preserve all actual introductory prose as a preface chapter.
 const prefix=lines.slice(0,first);const titleHeading=items.find(h=>h.index<first&&h.level===1&&!h.kind);
 const metadataIndices=new Set();
 if(titleHeading){title=titleHeading.text;metadataIndices.add(titleHeading.index);for(const h of items.filter(h=>h.index>titleHeading.index&&h.index<first&&h.level>1&&!h.kind)){subtitle+=(subtitle?'\n':'')+h.text;metadataIndices.add(h.index);}}
 const prose=prefix.filter((_,index)=>!metadataIndices.has(index));
 if(metadataIndices.size)frontMatter.push(...prefix.filter((_,index)=>metadataIndices.has(index)));
 if(meaningful(prose.join('\n'))&&boundaries.length)chapters.push({title:'序言',body:prose.join('\n').trim(),sourceStartLine:1,sourceEndLine:first});
 if(boundaries.length){for(let i=0;i<boundaries.length;i++){
  const current=boundaries[i],end=boundaries[i+1]?.index??lines.length,body=lines.slice(current.index+1,end).join('\n').trim();
  if(meaningful(body))chapters.push({title:current.text,body,sourceStartLine:current.index+1,sourceEndLine:end});
 }}else if(meaningful(input))chapters.push({title:fallbackTitle,body:String(input).trim(),sourceStartLine:1,sourceEndLine:lines.length});
 // A heading-only document is not a readable chapter.
 return {chapters,title,subtitle,frontMatter:frontMatter.join('\n'),method};
}
