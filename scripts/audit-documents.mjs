// Local-only corpus audit. No network requests; the report excludes body text.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import Turndown from 'turndown';
import {analyseChapters} from '../src/chapter-analysis.js';
import {decodeDocumentText,normalizeImportedText,checkDocxArchive} from '../src/document-model.js';
const directory=process.argv[2];if(!directory)throw Error('Usage: node scripts/audit-documents.mjs <directory> [report.json]');
const output=process.argv[3],rows=[];
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()&&!entry.name.startsWith('.')&&entry.name!=='node_modules'?walk(path.join(dir,entry.name)):entry.isFile()&&/\.(md|markdown|txt|docx)$/i.test(entry.name)?[path.join(dir,entry.name)]:[]);}
for(const filename of walk(directory)){
 const name=path.relative(directory,filename);try{
  const buffer=readFileSync(filename);let text;
  if(/\.docx$/i.test(name)){checkDocxArchive(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));const converted=await mammoth.convertToHtml({buffer},{externalFileAccess:false});text=new Turndown({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'}).turndown(converted.value);}
  else text=decodeDocumentText(buffer).text;
  const result=analyseChapters(normalizeImportedText(text));
  const range=name.match(/[（(](\d+)\s*[-–]\s*(\d+)[)）]/),total=name.match(/全(\d+)集/),expected=range?Number(range[2])-Number(range[1])+1:total?Number(total[1]):/前五集/.test(name)?5:null;
  const isBody=/正文|总集篇|前五集/.test(name),matched=!isBody||expected===null||result.chapters.length===expected;
  rows.push({name,format:path.extname(name).slice(1),characters:text.length,chapters:result.chapters.length,method:result.method,expected:isBody?expected:null,matched,first:result.chapters[0]?.title,last:result.chapters.at(-1)?.title});
 }catch(error){rows.push({name,error:error.message,matched:false});}
}
const report={files:rows.length,passed:rows.filter(r=>r.matched).length,failed:rows.filter(r=>!r.matched).length,rows};
if(output)writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({files:report.files,passed:report.passed,failed:report.failed,byFormat:Object.fromEntries(['md','txt','docx'].map(format=>[format,rows.filter(r=>r.format===format).length]))}));
if(report.failed){console.error(JSON.stringify(rows.filter(r=>!r.matched)));process.exitCode=1;}
