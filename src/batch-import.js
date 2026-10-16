import {analyseChapters} from './chapter-analysis.js';
import {DOCUMENT_TYPES,MAX_DOCUMENT_BYTES,titleFromFilename} from './document-model.js';
export const MAX_IMPORT_FILES=100,MAX_BATCH_BYTES=50*1024*1024,MAX_BOOK_CHARACTERS=200000;
const collator=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'});
const digits={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
export function chineseNumber(value){
 if(!value)return null;const s=value.normalize('NFKC');if(/^\d+$/.test(s))return Number(s);
 if(!/^[零〇一二两三四五六七八九十百千万]+$/.test(s))return null;
 if(!/[十百千万]/.test(s))return Number([...s].map(c=>digits[c]).join(''));
 let total=0,section=0,n=0;for(const c of s){if(c in digits)n=digits[c];else if(c==='万'){total+=(section+n||1)*10000;section=0;n=0;}else{section+=(n||1)*({'十':10,'百':100,'千':1000}[c]);n=0;}}return total+section+n;
}
function romanNumber(s){let sum=0;const map={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};s=s.toUpperCase();for(let i=0;i<s.length;i++){const v=map[s[i]];if(!v)return null;sum+=v<(map[s[i+1]]||0)?-v:v;}return sum;}
function sortPart(part){
 let s=part.normalize('NFKC').replace(/\.[^.]+$/,'');
 const special=s.replace(/^[\d\s._-]+/,'');if(/^(序章|序言|前言|楔子|prologue)(?:\b|\s|[：:]|$)/i.test(special))return '0-'+s;
 if(/^(尾声|后记|番外|epilogue)(?:\b|\s|[：:]|$)/i.test(special))return '2-'+s;
 s=s.replace(/第\s*([零〇一二两三四五六七八九十百千万\d]+)\s*([章节回卷部集])/g,(_,n,u)=>`${u}${chineseNumber(n)}`);
 s=s.replace(/^(chapter|volume|part)\s+([ivxlcdm]+)\b/i,(_,p,n)=>p+' '+romanNumber(n));
 s=s.replace(/^([零〇一二两三四五六七八九十百千万]+)([、.\s_-])/,(_,n,p)=>chineseNumber(n)+p);
 // Compare chapter numbers before their descriptive names, independent of Chinese/English prefix.
 s=s.replace(/^(?:章|节|回|卷|部|集|chapter\s*|volume\s*|part\s*)(\d+)/i,'$1');
 return '1-'+s;
}
export const filePath=file=>String(file.webkitRelativePath||file.name).replaceAll('\\','/');
export function compareDocumentPaths(a,b){const aa=filePath(a).split('/'),bb=filePath(b).split('/');for(let i=0;i<Math.min(aa.length,bb.length);i++){const difference=collator.compare(sortPart(aa[i]),sortPart(bb[i]));if(difference)return difference;}return aa.length-bb.length||collator.compare(filePath(a),filePath(b));}
export function planImport(files){
 const supported=[],skipped=[];
 for(const file of files){const path=filePath(file),parts=path.split('/'),ext=file.name.split('.').pop().toLowerCase();if(parts.some(p=>p.startsWith('.')||p==='__MACOSX')||file.name.startsWith('~$')||!DOCUMENT_TYPES.includes(ext)){skipped.push({path,reason:'隐藏文件、临时文件或不支持的格式'});continue;}supported.push(file);}
 if(!supported.length)throw Error('没有找到可导入的 DOCX、TXT、Markdown 或文字型 PDF 文档。');
 if(supported.length>MAX_IMPORT_FILES)throw Error('一次最多导入 100 个文档，请分批选择。');
 if(supported.reduce((n,f)=>n+f.size,0)>MAX_BATCH_BYTES)throw Error('这批文档超过 50 MB，请分批导入。');
 const oversize=supported.find(f=>f.size>MAX_DOCUMENT_BYTES);if(oversize)throw Error(`${oversize.name} 超过单文件 10 MB 上限。请缩小后重试。`);
 return {files:[...supported].sort(compareDocumentPaths),skipped};
}
export async function prepareImport(files,parse,onProgress=()=>{}){
 const plan=planImport(files),chapters=[],sources=[],failed=[],warnings=[];let total=0,detectedTitle='';
 for(let i=0;i<plan.files.length;i++){
  const file=plan.files[i],path=filePath(file);onProgress(`解析 ${i+1} / ${plan.files.length}：${path}`);
  let result;try{result=await parse(file,message=>onProgress(`${i+1} / ${plan.files.length} · ${file.name}：${message}`));}catch(err){failed.push({path,reason:err.message||'解析失败'});continue;}
  const analysis=analyseChapters(result.markdown,{fallbackTitle:titleFromFilename(file.name)}),extracted=analysis.chapters;
  if(!extracted.length){failed.push({path,reason:'只找到标题或分隔线，没有可阅读的正文'});continue;}
  if(!detectedTitle)detectedTitle=analysis.title;
  if(analysis.title||analysis.subtitle)warnings.push(`${file.name}：已提取书名「${analysis.title}」${analysis.subtitle?'，副标题「'+analysis.subtitle+'」':''}，不作为章节。大纲、视角说明及章末注记保留在所属章内。`);
  const nextTotal=total+extracted.reduce((n,c)=>n+c.body.length,0);
  if(nextTotal>MAX_BOOK_CHARACTERS)throw Error('这批文档正文合计超过 20 万字符。当前草稿没有更改，请减少文档后重试。');
  if(chapters.length+extracted.length>1000)throw Error('识别结果超过 1000 章，请减少文档后重试。');
  total=nextTotal;sources.push({path,start:chapters.length,count:extracted.length,method:analysis.method,frontMatter:analysis.frontMatter,subtitle:analysis.subtitle});chapters.push(...extracted);
  for(const message of result.warnings||[])warnings.push(`${file.name}：${message}`);
 }
 const root=plan.files[0].webkitRelativePath?.split('/')[0];
 return {chapters,sources,failed,skipped:plan.skipped,warnings,total,title:root||detectedTitle||titleFromFilename(plan.files[0].name)};
}
export function mergeChapters(existing,incoming,mode){
 const chapters=mode==='replace'?[...incoming]:[...existing.filter(c=>c.body.trim()),...incoming];
 if(!incoming.length)throw Error('没有成功识别的章节可导入。');
 if(chapters.length>1000||chapters.reduce((n,c)=>n+c.body.length,0)>MAX_BOOK_CHARACTERS)throw Error('合并后超过 1000 章或 20 万字符上限。请减少文档，或选择替换当前章节。');
 return chapters;
}
