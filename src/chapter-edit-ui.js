import {splitChapter,mergeNextChapter,changedTitles} from './chapter-edit.js';
import {draftKey} from './draft-store.js';
import {newDraftKey} from './draft-manager.js';
const undoByDraft=new Map();
export function chapterEditMarkup(){return `<div class="chapter-split-tools"><div><strong>手动分章</strong><small>在正文中放置光标，再点拆分；选中文字时，从选区开头拆。</small></div><div><button type="button" id="split-at-cursor">从光标处拆为下一章</button><button type="button" id="merge-next-chapter">合并下一章</button><button type="button" id="undo-chapter-edit">撤销上次拆分 / 合并</button></div><span id="split-position" role="status">点击正文选择断点 · Ctrl / ⌘ + Enter 拆分</span></div>`;}
export function bindChapterEdits({getDraft,getSelected,commit,modal,esc,toast}){
 const editor=document.querySelector('#chapter-body');if(!editor)return;const key=draftKey(getDraft()),undo=undoByDraft.get(key);document.querySelector('#undo-chapter-edit').disabled=!undo;document.querySelector('#merge-next-chapter').disabled=getSelected()>=getDraft().chapters.length-1;
 function position(){const offset=editor.selectionStart;document.querySelector('#split-position').textContent=`断点前 ${offset.toLocaleString()} 字符 · 后 ${(editor.value.length-offset).toLocaleString()} 字符${editor.selectionStart!==editor.selectionEnd?' · 使用选区开头':''}`;}
 ['select','click','keyup','input'].forEach(type=>editor.addEventListener(type,position));
 function snapshot(){return {original:getDraft(),index:getSelected(),chapters:structuredClone(getDraft().chapters)};}
 async function saveOperation(state,chapters,label,index,{undoing=false}={}){
  if(getDraft()!==state.original||JSON.stringify(getDraft().chapters)!==JSON.stringify(state.chapters))throw Error('章节已发生变化，请关闭窗口后重新操作');
  const backup={...structuredClone(state.original),draftKey:newDraftKey(),title:((state.original.title||'未命名作品')+' · '+label+'前备份').slice(0,100)};
  await commit({...state.original,chapters},index,backup);
  if(undoing)undoByDraft.delete(key);else undoByDraft.set(key,{chapters:state.chapters,index:state.index,label});
  // commit rebuilds the editor before the undo record is stored.
  const button=document.querySelector('#undo-chapter-edit');if(button)button.disabled=!undoByDraft.has(key);
  toast(`${label}已完成，操作前版本保留在草稿箱`);
 }
 function preview(kind){
  const state=snapshot(),offset=editor.selectionStart,current=state.chapters[state.index];let next;
  try{next=kind==='split'?splitChapter(state.chapters,state.index,offset,{renumber:false}):mergeNextChapter(state.chapters,state.index,{renumber:false});}catch(error){toast(error.message);return;}
  const label=kind==='split'?'拆分':'合并';
  modal(`<span class="eyebrow">CHAPTER WORKSHOP</span><h2>${kind==='split'?'从这里开启下一章':'将下一章并入当前章'}</h2><p>${kind==='split'?'断点后的全部文字移入新章，新章紧接当前章；文字不删减。':'下一章正文追加到当前章，以空行分隔；保留当前章标题。'}</p>${kind==='split'?`<label class="split-title-label">新章节标题<input id="split-new-title" maxlength="100" value="${esc(next[state.index+1].title)}"></label><div class="split-preview"><section><strong>当前章末尾 · ${offset.toLocaleString()} 字符</strong><pre>${esc(current.body.slice(Math.max(0,offset-150),offset))}</pre></section><section><strong>下一章开头 · ${(current.body.length-offset).toLocaleString()} 字符</strong><pre>${esc(current.body.slice(offset,offset+150))}</pre></section></div>`:`<p>「${esc(current.title)}」＋「${esc(state.chapters[state.index+1].title)}」</p><p>合并后 ${next[state.index].body.length.toLocaleString()} 字符，下一章标题不写入正文。</p>`}<label class="split-renumber"><input type="checkbox" id="split-renumber" checked>顺延后续同类章节编号，保留章名（遇分卷或重编号停止）</label><div id="split-title-changes"></div><p>确认后自动保存，并在草稿箱创建操作前备份。</p><p id="chapter-edit-error" role="alert"></p><div class="actions"><button class="primary" id="confirm-chapter-edit">确认${label}</button><button data-action="close">取消，保留原章</button></div>`);
  function calculate(){const renumber=document.querySelector('#split-renumber').checked;next=kind==='split'?splitChapter(state.chapters,state.index,offset,{title:document.querySelector('#split-new-title').value,renumber}):mergeNextChapter(state.chapters,state.index,{renumber});const changes=changedTitles(state.chapters,next,kind,state.index);document.querySelector('#split-title-changes').innerHTML=changes.length?`<details><summary>将调整 ${changes.length} 个后续章名编号</summary><ul>${changes.slice(0,40).map(c=>`<li>${esc(c.before)} → ${esc(c.after)}</li>`).join('')}</ul>${changes.length>40?'<p>其余同类编号按相同规则顺延。</p>':''}</details>`:'<p>后续章名不变；左侧目录序号自动更新。</p>';}
  function refresh(){try{calculate();document.querySelector('#chapter-edit-error').textContent='';document.querySelector('#confirm-chapter-edit').disabled=false;}catch(error){document.querySelector('#chapter-edit-error').textContent=error.message;document.querySelector('#confirm-chapter-edit').disabled=true;}}
  document.querySelector('#split-renumber').onchange=refresh;document.querySelector('#split-new-title')?.addEventListener('input',refresh);refresh();
  document.querySelector('#confirm-chapter-edit').onclick=async()=>{const button=document.querySelector('#confirm-chapter-edit');button.disabled=true;try{calculate();await saveOperation(state,next,label,kind==='split'?state.index+1:state.index);}catch(error){const target=document.querySelector('#chapter-edit-error');if(target)target.textContent=error.message;else toast(error.message);}finally{if(button.isConnected)button.disabled=false;}};
 }
 document.querySelector('#split-at-cursor').onclick=()=>preview('split');document.querySelector('#merge-next-chapter').onclick=()=>preview('merge');
 editor.addEventListener('keydown',event=>{if(!event.isComposing&&(event.ctrlKey||event.metaKey)&&!event.altKey&&event.key==='Enter'){event.preventDefault();preview('split');}});
 document.querySelector('#undo-chapter-edit').onclick=()=>{const record=undoByDraft.get(key);if(!record)return;const state=snapshot();modal(`<h2>撤销上次${esc(record.label)}？</h2><p>恢复为该操作前的 ${record.chapters.length} 章。操作后对章节所作的修改也会回退；系统先在草稿箱备份当前版本，作品资料保留。</p><p id="chapter-edit-error" role="alert"></p><div class="actions"><button class="primary" id="confirm-undo-chapter">备份当前版本并撤销</button><button data-action="close">取消</button></div>`);document.querySelector('#confirm-undo-chapter').onclick=async()=>{const button=document.querySelector('#confirm-undo-chapter');button.disabled=true;try{await saveOperation(state,structuredClone(record.chapters),'撤销',record.index,{undoing:true});}catch(error){document.querySelector('#chapter-edit-error').textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}};};
}
