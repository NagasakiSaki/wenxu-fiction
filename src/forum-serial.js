import {chineseNumber} from './chapter-numbers.js';

const heading=text=>text.trim().replace(/^#{1,6}\s+/, '').replace(/^(\*\*|__)(.*?)\1$/, '$2');
const episode=text=>heading(text).match(/^第\s*([零〇一二两三四五六七八九十百千万\d０-９]+)\s*([章节话回集幕])\s*(.*)$/u);
const note=/^(?:剧情|的剧情|预计|计划|将会|将在|准备|预告|结束后|开始前)/u;
const ending=/(?:\s|[：:])(完|结束|终)\s*$/u;

/** Strong post headers only: floor/UID + profile + timestamp, outside fences. */
export function inspectSerialPosts(lines,rawLines=lines){
 const posts=[],fenced=new Set();let fence=null;
 for(let i=0;i<lines.length;i++){
  const m=lines[i].trim().match(/^(`{3,}|~{3,})/);
  if(m){if(!fence)fence=m[1];else if(m[1][0]===fence[0]&&m[1].length>=fence.length)fence=null;fenced.add(i);continue;}
  if(fence){fenced.add(i);continue;}
  const header=lines[i].match(/^\s*#(\d{1,6})\s*([^\n]{1,60}?)\s+(\d{5,12})\s*$/u);
  if(!header)continue;
  const nearby=lines.slice(i+1,i+6),profile=nearby.findIndex(l=>/^级别[:：].*(?:注册|威望)[:：]/u.test(l.trim()));
  const time=nearby.findIndex(l=>/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?\s*$/u.test(l.trim()));
  if(profile<0||time<=profile)continue;
  posts.push({line:i+1,floor:Number(header[1]),author:header[2].trim(),uid:header[3],timestamp:nearby[time].trim(),headerEnd:i+time+2});
 }
 if(posts.length<3)return {recognized:false,posts:[],metadata:new Map(),fenced};
 const metadata=new Map(),mark=(index,code,label)=>{if(!fenced.has(index)&&lines[index]?.trim())metadata.set(index,{code,label});};
 posts.forEach((post,index)=>{
  post.endLine=posts[index+1]?.line-1||lines.length;
  for(let i=post.line-1;i<post.headerEnd;i++)mark(i,'serial-header','帖子作者与时间');
  // Vote counts are removed only with the captured zero-width UI marker.
  const vote=post.headerEnd;
  if(/^\s*\d+\s*$/.test(lines[vote]||'')&&/[\u200B\u2060]/.test(rawLines[vote]||''))mark(vote,'serial-votes','帖子投票计数');
 });
 // Repeated NGA navigation is bounded by a complete navigation signature and a post.
 for(let i=0;i<lines.length;i++){
  if(fenced.has(i))continue;
  if(/^⚙\uFE0F?$/.test(lines[i].trim())){
   const next=posts.find(p=>p.line>i+1&&p.line<=i+81),window=lines.slice(i,next?.line||i+40).map(l=>l.trim());
   if(next&&['你好','登录','消息','N G A'].every(token=>window.includes(token)))for(let j=i;j<next.line-1;j++)mark(j,'serial-navigation','论坛导航');
  }
  if(lines[i].trim()==='附件'&&lines[i+1]?.trim()==='显示全部附件'){
   mark(i,'serial-attachments','附件控件');mark(i+1,'serial-attachments','附件控件');
  }
  if(lines[i].trim()==='改动'&&/^在\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}修改\s*$/u.test(lines[i+1]?.trim()||'')){
   mark(i,'serial-edit','编辑记录');mark(i+1,'serial-edit','编辑记录');
  }
 }
 return {recognized:true,posts,metadata,fenced};
}

export function serialNoise(lines,inspection){
 const entries=[],counts={};let removedCharacters=0;
 for(const [index,role] of [...inspection.metadata].sort((a,b)=>a[0]-b[0])){
  const text=lines[index].trim();entries.push({line:index+1,...role,text:text.slice(0,60),evidence:['论坛帖子结构联合确认']});
  counts[role.code]=(counts[role.code]||0)+1;removedCharacters+=text.length;
 }
 return {remove:new Set(inspection.metadata.keys()),entries,suspects:[],counts,removedCharacters};
}

/** Classify titles; preserve all non-selected title-like lines as original body. */
export function serialPlan(lines,posts,sourceLines,{metadataLines=new Set()}={}){
 const roles=[],arcs=[],seen=new Map(),headings=[];let arc='',fence=null,postIndex=0;
 const content=lines.map(l=>l.replace(/\s/g,'').length),prefix=[0];content.forEach(n=>prefix.push(prefix.at(-1)+n));
 const role=(line,kind,message,extra={})=>roles.push({line,kind,message,...extra});
 for(let i=0;i<lines.length;i++){
  const text=heading(lines[i]),marker=text.match(/^(`{3,}|~{3,})/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;continue;}
  if(fence)continue;
  const next=lines.slice(i+1,i+5).find(l=>l.trim()),nextEpisode=next&&episode(next);
  if(text.length<=60&&/^[\p{L}\p{N} _·—-]{2,60}(?:篇|卷|部)$/u.test(text)&&nextEpisode&&chineseNumber(nextEpisode[1])<=1&&!/[。！？：:]/u.test(text)&&headings.length){
   arc=text;arcs.push({line:i+1,title:arc});role(i+1,'arc','分篇标题；下属章节可从零或一重新编号');continue;
  }
  const parsed=episode(text);if(!parsed||text.length>100)continue;
  const number=chineseNumber(parsed[1]),suffix=parsed[3].trim();
  if(note.test(suffix)||/[。！？!?]$/.test(text)){
   role(i+1,'commentary','标题引用或作者说明，保留正文，不作为分界');continue;
  }
  if(ending.test(text)||/^(?:完|结束|终)$/.test(suffix)){role(i+1,'ending','章末标记，保留在上一章，不作为新章');continue;}
  const key=arc+'\0'+parsed[2]+'\0'+number+'\0'+suffix.replace(/\s/g,''),previous=seen.get(key);
  if(previous&&prefix[i]-prefix[previous-1]<=600){
   role(i+1,'repeat','附近已有相同话标题，合并候选；重复文字仍保留正文',{relatedLine:previous});continue;
  }
  seen.set(key,i+1);headings.push(i+1);
  const original=sourceLines[i];
  while(postIndex+1<posts.length&&posts[postIndex+1].line<=original)postIndex++;
  const post=posts[postIndex],nextOriginal=sourceLines.slice(i+1,Math.min(lines.length,i+9)).find((n,j)=>!metadataLines.has(n)&&lines[i+j+1]?.trim());
  const tail=post&&original>=post.line&&(!nextOriginal||nextOriginal>post.endLine);
  role(i+1,'start',previous?'同篇同名标题再次出现，可能为续更，请核对':tail?'标题在楼尾，可能为点题或下话预告，请核对':'章节开始候选',{needsReview:!!tail||!!previous,number,volume:arc,...(previous?{relatedLine:previous}:{})});
 }
 return {headings,roles,arcs};
}

export function withSerialVolumes(chapters,serial){
 if(!serial?.recognized)return chapters;
 return chapters.map(chapter=>{
  const arc=[...(serial.arcs||[])].reverse().find(item=>item.line<chapter.sourceStartLine);
  return arc?{...chapter,volume:arc.title}:chapter;
 });
}
