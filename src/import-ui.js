import {showImportReview} from './import-review.js';
import {runChapterAnalysis} from './chapter-engine.js';
import {prepareImport,mergeChapters} from './batch-import.js';
let busy=false;
export function bindDocumentImports({getDraft,apply,modal,esc,toast}){
 const status=message=>{const el=document.querySelector('#import-status');if(el)el.textContent=message;};
 const run=async event=>{
  const input=event.target,files=[...input.files];input.value='';if(!files.length||busy)return;
  const original=getDraft(),mode=document.querySelector('#import-mode').value;
  busy=true;const controls=[...document.querySelectorAll('main input,main button,main select,main textarea')].map(el=>({el,disabled:el.disabled}));controls.forEach(({el})=>el.disabled=true);
  try{
   const {importDocument}=await import('./document-import.js');const result=await prepareImport(files,importDocument,status,runChapterAnalysis);
   if(location.hash!=='#/studio'||getDraft()!==original){toast('已离开导入页面，当前草稿没有更改，请重新选择文档');return;}
   status(`识别完成：${result.sources.length} 个文档、${result.chapters.length} 章。请查看导入结果。`);
   showImportReview({result,mode,modal,esc,toast,onConfirm:async reviewed=>{if(location.hash!=='#/studio'||getDraft()!==original)throw Error('草稿已改变，请重新导入');const chapters=mergeChapters(original.chapters,reviewed.chapters,mode);const stored=await apply({...original,title:original.title||reviewed.title,chapters,importNotes:[...(mode==='replace'?[]:original.importNotes||[]),...reviewed.sources.filter(s=>s.frontMatter).map(s=>({file:s.path,text:s.frontMatter,subtitle:s.subtitle}))]},mode==='replace'?0:original.chapters.filter(c=>c.body.trim()).length);toast(stored===false?`已导入 ${reviewed.chapters.length} 章，但保存失败，请立即导出备份。`:`已导入 ${reviewed.chapters.length} 章，并保存本机草稿。尚未公开发布。`);}});
  }catch(err){status(err.message);toast('导入未完成，原草稿已保留');}finally{busy=false;controls.forEach(({el,disabled})=>el.disabled=disabled);}
 };
 document.querySelector('#document').onchange=run;
 document.querySelector('#folder').onchange=run;
}
