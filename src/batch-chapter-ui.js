import {bindBreakpointView} from './chapter-breakpoint-view.js';
import {splitChapterAtPoints} from './chapter-edit.js';
import {suggestBreaks} from './break-suggestions.js';
export function bindBatchChapters({editor,getDraft,getSelected,modal,esc,toast,saveOperation,snapshot,onChange=()=>{}}){
 const chapter=getDraft().chapters[getSelected()];
 let marks=Array.isArray(chapter.pendingBreakpoints)?[...new Set(chapter.pendingBreakpoints.filter(n=>Number.isInteger(n)&&n>0&&n<chapter.body.length&&!(/[\uD800-\uDBFF]/.test(chapter.body[n-1])&&/[\uDC00-\uDFFF]/.test(chapter.body[n]))))].sort((a,b)=>a-b).slice(0,999):[];
 const persist=()=>{if(marks.length)chapter.pendingBreakpoints=[...marks];else delete chapter.pendingBreakpoints;onChange();};
 const markButton=document.querySelector('#mark-chapter-point'),batchButton=document.querySelector('#batch-chapter-split');
 const view=bindBreakpointView(editor),list=document.querySelector('#chapter-breakpoint-list'),lineStarts=[0];
 let indexedBody=null;
 const safe=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function cursorStatus(){markButton.textContent=marks.includes(editor.selectionStart)?'取消当前位置断点':'标记当前断点';}
 const status=()=>{
  if(marks.length&&indexedBody!==editor.value){indexedBody=editor.value;lineStarts.length=1;for(let i=0;i<indexedBody.length;i++)if(indexedBody[i]==='\n')lineStarts.push(i+1);}
  batchButton.textContent=`批量拆章（${marks.length} 个断点）`;view.update(marks);cursorStatus();
  list.innerHTML=marks.length?`<div class="breakpoint-list-heading"><strong>已标记 ${marks.length} 个断点 · 正文对应行已高亮</strong><button type="button" data-break-clear>清空本章断点</button></div><div class="breakpoint-list-items">${marks.map(offset=>{
   let low=0,high=lineStarts.length;while(low+1<high){const mid=(low+high)>>1;if(lineStarts[mid]<=offset)low=mid;else high=mid;}const line=low+1,column=offset-lineStarts[low]+1;
   return `<div class="breakpoint-entry"><button type="button" data-break-jump="${offset}" aria-label="定位第 ${offset} 字符处断点">第 ${line} 行 · 第 ${column} 列<small>${safe(editor.value.slice(Math.max(0,offset-14),offset))} │ ${safe(editor.value.slice(offset,offset+20))}</small></button><button type="button" data-break-remove="${offset}" aria-label="取消第 ${offset} 字符处断点">取消断点</button></div>`;
  }).join('')}</div>`:'<small>标记后正文对应行会高亮，可在这里定位或取消断点。</small>';
 };
 function remove(offset){marks=marks.filter(p=>p!==offset);persist();status();toast('已取消断点');}
 list.onclick=event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-break-clear')){marks=[];persist();status();toast('已清空当前章断点');}
  else if(button.dataset.breakRemove!==undefined)remove(Number(button.dataset.breakRemove));
  else if(button.dataset.breakJump!==undefined)view.jump(Number(button.dataset.breakJump));
 };
 ['select','click','keyup'].forEach(type=>editor.addEventListener(type,cursorStatus));
 markButton.onclick=()=>{const offset=editor.selectionStart;if(offset<=0||offset>=editor.value.length)return toast('请在正文内部放置光标');if(/[\uD800-\uDBFF]/.test(editor.value[offset-1])&&/[\uDC00-\uDFFF]/.test(editor.value[offset]))return toast('断点不能位于一个字符内部');if(marks.includes(offset))return remove(offset);if(marks.length>=999)return toast('每章最多标记999个断点');marks.push(offset);marks.sort((a,b)=>a-b);persist();status();toast(`已标记第 ${offset} 字符处，可继续标记其他位置`);};
 editor.addEventListener('input',()=>{if(marks.length){marks=[];persist();status();toast('正文已修改，旧断点已清除，请重新标记');}});
 function open(recommend=false){const state=snapshot(),body=state.chapters[state.index].body;let points=marks.map(offset=>({offset,type:'手动'})),selected=new Set(points.map(p=>p.offset)),target=3000,warning='';
  modal(`<span class="eyebrow">BATCH CHAPTER WORKSHOP</span><h2>${recommend?'按目标字数推荐断点':'一次确认多个分章断点'}</h2><p>所有断点都相对于当前章原文；确认后一次拆成连续章节，正文逐字保留。</p>${recommend?'<div class="batch-target"><label>每章目标字符数<input id="break-target" type="number" min="200" max="20000" value="3000"></label><label>推荐方式<select id="break-strategy"><option value="length">篇幅与段落</option><option value="scene">篇幅 + 场景线索</option></select></label><button id="recommend-breaks">生成断点建议</button></div><small>优先段落，其次句末；不理解情节，不强行截断无标点的长句。</small>':''}<label class="split-renumber"><input id="batch-renumber" type="checkbox" checked>顺延后续同类章名编号，保留描述性章名</label><p id="batch-summary" aria-live="polite"></p><div id="batch-breaks" class="batch-breaks"></div><div id="batch-segments" class="batch-segments"></div><p id="batch-error" role="alert"></p><div class="actions"><button id="confirm-batch-chapters" class="primary">确认批量拆章</button><button data-action="close">取消，保留原章</button></div><small>先创建操作前备份，再保存新章节；可撤销或从草稿箱恢复。</small>`);
  let next=null;
  function render(){const chosen=[...selected].sort((a,b)=>a-b);document.querySelector('#batch-breaks').innerHTML=points.map(p=>`<label class="batch-break"><input type="checkbox" data-break-offset="${p.offset}" ${selected.has(p.offset)?'checked':''}><span>第 ${p.offset.toLocaleString()} 字符 · ${esc(p.type)}<small>${esc(body.slice(Math.max(0,p.offset-32),p.offset))} │ ${esc(body.slice(p.offset,p.offset+32))}</small></span></label>`).join('')||'<p>还没有断点。返回正文标记多个位置，或生成建议。</p>';try{next=splitChapterAtPoints(state.chapters,state.index,chosen,{renumber:document.querySelector('#batch-renumber').checked});document.querySelector('#batch-summary').textContent=`${chosen.length} 个断点 → ${chosen.length+1} 章 · 全书 ${next.length} 章`;document.querySelector('#batch-error').textContent=warning;document.querySelector('#confirm-batch-chapters').disabled=false;const segments=next.slice(state.index,state.index+chosen.length+1);document.querySelector('#batch-segments').innerHTML=`<details><summary>查看各章篇幅与开头</summary><ol>${segments.map(c=>`<li>${esc(c.title)} · ${c.body.length.toLocaleString()} 字符<small>${esc(c.body.slice(0,70))}</small></li>`).join('')}</ol></details>`;}catch(error){next=null;document.querySelector('#batch-summary').textContent=`已选 ${chosen.length} 个断点`;document.querySelector('#batch-error').textContent=chosen.length?error.message:warning||'请至少选择一个断点';document.querySelector('#batch-segments').innerHTML='';document.querySelector('#confirm-batch-chapters').disabled=true;}}
  document.querySelector('#batch-breaks').onchange=event=>{const offset=Number(event.target.dataset.breakOffset);if(!offset)return;event.target.checked?selected.add(offset):selected.delete(offset);render();};document.querySelector('#batch-renumber').onchange=render;
  if(recommend)document.querySelector('#break-strategy').onchange=()=>{points=[];selected.clear();warning='推荐方式已更改，请重新生成建议';render();};
  if(recommend)document.querySelector('#break-target').oninput=()=>{points=[];selected.clear();warning='目标字数已更改，请重新生成建议';render();};
  if(recommend)document.querySelector('#recommend-breaks').onclick=()=>{try{target=Number(document.querySelector('#break-target').value);const result=suggestBreaks(body,target,{strategy:document.querySelector('#break-strategy').value});points=result.points;selected=new Set(points.map(p=>p.offset));warning=result.message+(result.limited?' 已达到999个建议上限，请增大目标字数。':'');render();}catch(error){document.querySelector('#batch-error').textContent=error.message;}};
  document.querySelector('#confirm-batch-chapters').onclick=async()=>{if(!next)return;const button=document.querySelector('#confirm-batch-chapters');button.disabled=true;try{await saveOperation(state,next,'批量拆分',state.index+1);marks=[];}catch(error){document.querySelector('#batch-error').textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}};render();
 }
 batchButton.onclick=()=>open(false);document.querySelector('#suggest-chapter-breaks').onclick=()=>open(true);status();
}
