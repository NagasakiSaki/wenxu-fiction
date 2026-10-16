import {prepareImport,mergeChapters} from './batch-import.js';
let busy=false;
export function bindDocumentImports({getDraft,apply,modal,esc,toast}){
 const status=message=>{const el=document.querySelector('#import-status');if(el)el.textContent=message;};
 const run=async event=>{
  const input=event.target,files=[...input.files];input.value='';if(!files.length||busy)return;
  const original=getDraft(),mode=document.querySelector('#import-mode').value;
  busy=true;const controls=[...document.querySelectorAll('main input,main button,main select,main textarea')].map(el=>({el,disabled:el.disabled}));controls.forEach(({el})=>el.disabled=true);
  try{
   const {importDocument}=await import('./document-import.js');const result=await prepareImport(files,importDocument,status);
   if(location.hash!=='#/studio'||getDraft()!==original){toast('已离开导入页面，当前草稿没有更改，请重新选择文档');return;}
   status(`识别完成：${result.sources.length} 个文档、${result.chapters.length} 章。请查看导入结果。`);
   const omissions=[...result.failed.map(f=>({...f,reason:'解析失败：'+f.reason})),...result.skipped];
   modal(`<span class="eyebrow">AUTOMATIC CHAPTER IMPORT</span><h2>已自动识别 ${result.chapters.length} 章</h2><p>${result.sources.length} 个文档成功，${result.failed.length} 个失败，${result.skipped.length} 个跳过。按文件夹层级和章节编号排序，单个文档内保留原章节顺序。</p><p class="import-mode-note">${mode==='replace'?'本次将替换当前全部章节。':'本次将追加到现有章节末尾。'}确认前不会更改草稿，也不会公开发表。</p>${omissions.length?`<details open class="import-notices"><summary>需要留意的文件（${omissions.length}）</summary><ul>${omissions.slice(0,30).map(f=>`<li><strong>${esc(f.path)}</strong>：${esc(f.reason)}</li>`).join('')}</ul>${omissions.length>30?'<p>其余文件已跳过。</p>':''}</details>`:''}${result.warnings.length?`<details class="import-notices"><summary>格式转换提醒（${result.warnings.length}）</summary><ul>${result.warnings.slice(0,30).map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:''}<div class="import-results">${result.sources.map(source=>`<section><h3>${esc(source.path)} <small>${source.count} 章 · ${esc(source.method)}</small></h3><ol start="${source.start+1}">${result.chapters.slice(source.start,source.start+source.count).map(c=>`<li>${esc(c.title)} <small>${c.body.length} 字符 · 第 ${c.sourceStartLine}–${c.sourceEndLine} 行</small></li>`).join('')}</ol></section>`).join('')}</div><p>${result.total.toLocaleString()} 字符 · 无章节标题的文档使用文件名作章名。导入后仍可修改顺序和正文。</p><p id="apply-error" role="alert"></p><div class="actions">${result.chapters.length?`<button class="primary" id="apply-import">${result.failed.length?'仅导入成功的':'导入这'} ${result.chapters.length} 章 →</button>`:''}<button data-action="close">取消，保留原草稿</button></div>`);
   const confirmButton=document.querySelector('#apply-import');if(confirmButton)confirmButton.onclick=()=>{try{if(getDraft()!==original)throw Error('草稿已改变，请重新导入');const chapters=mergeChapters(original.chapters,result.chapters,mode);apply({...original,title:original.title||result.title,chapters,importNotes:[...(mode==='replace'?[]:original.importNotes||[]),...result.sources.filter(s=>s.frontMatter).map(s=>({file:s.path,text:s.frontMatter,subtitle:s.subtitle}))]},mode==='replace'?0:original.chapters.filter(c=>c.body.trim()).length);toast(`已导入 ${result.chapters.length} 章，并保存本机草稿。尚未公开发布。`);}catch(err){document.querySelector('#apply-error').textContent=err.message;}};
  }catch(err){status(err.message);toast('导入未完成，原草稿已保留');}finally{busy=false;controls.forEach(({el,disabled})=>el.disabled=disabled);}
 };
 document.querySelector('#document').onchange=run;
 document.querySelector('#folder').onchange=run;
}
