const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function breakpointMarkup(body,offsets){
 const points=[...new Set(offsets)].sort((a,b)=>a-b);let start=0,cursor=0;
 return body.split('\n').map(line=>{
  const end=start+line.length,local=[];
  while(cursor<points.length&&points[cursor]<=end){if(points[cursor]>=start)local.push(points[cursor]);cursor++;}
  let html='',previous=start;
  for(const point of local){html+=escape(body.slice(previous,point))+`<span class="breakpoint-pin" data-pin="${point}"></span>`;previous=point;}
  html+=escape(body.slice(previous,end));start=end+1;
  return local.length?`<span class="breakpoint-line has-breakpoint">${html||'&#8203;'}</span>`:escape(line);
 }).join('\n')+'&#8203;';
}

// A non-interactive mirror adds highlights while the textarea keeps native editing/IME.
export function bindBreakpointView(editor){
 if(!editor.ownerDocument)return {update:()=>{},jump:()=>{}};
 const doc=editor.ownerDocument,wrapper=doc.createElement('div'),mirror=doc.createElement('div');
 wrapper.className='breakpoint-editor';mirror.className='breakpoint-mirror';mirror.setAttribute('aria-hidden','true');
 editor.before(wrapper);wrapper.append(mirror,editor);
 let marks=[];
 function sync(){mirror.scrollTop=editor.scrollTop;mirror.scrollLeft=editor.scrollLeft;}
 function size(){
  const style=getComputedStyle(editor);
  for(const name of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','textAlign','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'])mirror.style[name]=style[name];
  // Exclude the textarea's native scrollbar so wrapped lines share the same width.
  mirror.style.width=(editor.clientWidth+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth))+'px';
  mirror.style.height=editor.offsetHeight+'px';sync();
 }
 function update(points){marks=[...points];if(!marks.length&&!mirror.innerHTML){mirror.hidden=true;return;}mirror.innerHTML=marks.length?breakpointMarkup(editor.value,marks):'';mirror.hidden=!marks.length;size();}
 function jump(offset){
  editor.focus({preventScroll:true});editor.setSelectionRange(offset,offset);
  const pin=mirror.querySelector(`[data-pin="${offset}"]`);
  if(pin){editor.scrollTop=Math.max(0,pin.offsetTop-editor.clientHeight/2);sync();}
  editor.scrollIntoView({block:'center'});
  editor.dispatchEvent(new Event('select'));
 }
 // 输入事件可能连发（输入法、快捷键），合并到下一帧只重建一次镜像。
 let frame=0;const schedule=()=>{if(frame)return;const run=()=>{frame=0;update(marks);};frame=typeof requestAnimationFrame==='function'?requestAnimationFrame(run):setTimeout(run,16);};
 editor.addEventListener('scroll',sync);editor.addEventListener('input',schedule);
 const observer=new ResizeObserver(size);observer.observe(editor);
 // Rebinding replaces the editor; stop observing detached nodes after that render.
 const removal=new MutationObserver(()=>{if(!editor.isConnected){observer.disconnect();removal.disconnect();}});
 removal.observe(doc.querySelector('#app')||doc.body,{childList:true,subtree:true});
 return {update,jump};
}
