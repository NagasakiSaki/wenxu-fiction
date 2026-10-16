import {addBookmark,loadReadingData,recordReading,positionHref,searchBook,resolveChapter} from './reading-data.js';
import {bookmarkCards,bindBookmarkActions,readingEsc as esc} from './reading-library.js';
function textOffset(paragraph,node,offset){try{const range=document.createRange();range.selectNodeContents(paragraph);range.setEnd(node,offset);return range.toString().length;}catch{return 0;}}
function caretRange(paragraph,offset){const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);let node,remaining=Math.max(0,offset);while((node=walker.nextNode())){if(remaining<=node.textContent.length){const range=document.createRange();range.setStart(node,remaining);range.setEnd(node,Math.min(remaining+1,node.textContent.length));return range;}remaining-=node.textContent.length;}return null;}
export function attachReaderTools({root,book,n,settings,getPage,setPage,toast}){
 const body=root.querySelector('.reading-body'),ps=[...body.querySelectorAll('p')],abort=new AbortController();let started=false,lastAnchor=null,writeTimer,scrollFrame,storageWarned=false;
 const dialog=document.querySelector('#reader-tools-dialog'),noteDialog=document.querySelector('#reader-note-dialog');
 function capture(){
  if(!root.isConnected)return lastAnchor;
  const box=settings.mode==='paged'?body.getBoundingClientRect():{top:Math.max(8,root.querySelector('.reader-toolbar').getBoundingClientRect().bottom+8,body.getBoundingClientRect().top),bottom:innerHeight,left:body.getBoundingClientRect().left,right:body.getBoundingClientRect().right};
  let paragraph=body.getBoundingClientRect().bottom<=box.top?Math.max(0,ps.length-1):0,rect=null;
  for(let i=0;i<ps.length;i++){const visible=[...ps[i].getClientRects()].find(r=>r.right>box.left+3&&r.left<box.right-3&&r.bottom>box.top+3&&r.top<box.bottom-3);if(visible){paragraph=i;rect=visible;break;}}
  const p=ps[paragraph];if(!p)return null;let offset=0;
  if(rect){const y=Math.max(box.top+5,rect.top+Math.min(16,settings.size*.6)),x=Math.max(box.left+10,rect.left+Math.min(settings.size*2.2,60));const caret=document.caretPositionFromPoint?.(x,y);const range=!caret&&document.caretRangeFromPoint?.(x,y);const node=caret?.offsetNode||range?.startContainer,nodeOffset=caret?.offset??range?.startOffset;if(node&&p.contains(node))offset=textOffset(p,node,nodeOffset);}
  // Store paragraph and text offset instead of page number, which changes with font size.
  return {bookId:book.id,bookTitle:book.title,chapter:n,chapterTitle:book.chapters[n].title,paragraph,offset,excerpt:p.textContent.slice(offset,offset+120),updatedAt:Date.now()};
 }
 function persist(position=lastAnchor){if(!position)return;try{recordReading({...position,updatedAt:Date.now()});}catch{if(!storageWarned){toast('阅读记录保存失败，请导出书签备份后检查浏览器空间');storageWarned=true;}}}
 function update(){if(!started||!root.isConnected||dialog.open)return;lastAnchor=capture()||lastAnchor;const active=loadReadingData().bookmarks.some(mark=>!mark.deletedAt&&mark.bookId===book.id&&mark.chapter===n&&mark.paragraph===lastAnchor?.paragraph&&Math.abs(mark.offset-(lastAnchor?.offset||0))<30);const quick=root.querySelector('#bookmark-current');if(quick){quick.textContent=active?'已加书签 ✓':'＋书签';quick.setAttribute('aria-pressed',String(active));}clearTimeout(writeTimer);writeTimer=setTimeout(()=>persist(),300);}
 function restore(anchor,{flash=false}={}){
  if(!anchor||!ps.length||!root.isConnected)return;let index=Math.max(0,Math.min(Number(anchor.paragraph)||0,ps.length-1)),offset=Math.max(0,Number(anchor.offset)||0);
  if(anchor.excerpt&&!ps[index].textContent.includes(anchor.excerpt)){const found=ps.findIndex(p=>p.textContent.includes(anchor.excerpt));if(found>=0){index=found;offset=ps[found].textContent.indexOf(anchor.excerpt);}}
  const p=ps[index],range=caretRange(p,offset),rect=range?.getBoundingClientRect();
  if(settings.mode==='paged'){const bounds=body.getBoundingClientRect(),x=rect&&rect.width?rect.left-bounds.left+body.scrollLeft:p.getClientRects()[0]?.left-bounds.left+body.scrollLeft;setPage(Math.floor(Math.max(0,x||0)/(body.clientWidth+32)));}
  else{const y=rect?.height?rect.top:p.getBoundingClientRect().top;window.scrollTo({top:Math.max(0,scrollY+y-root.querySelector('.reader-toolbar').getBoundingClientRect().height-24),behavior:'instant'});}
  if(flash){p.classList.add('reading-target');setTimeout(()=>p.classList.remove('reading-target'),1800);}
 }
 function show(html){dialog.innerHTML=`<button class="close" id="close-reader-tools" aria-label="关闭阅读工具">×</button>${html}`;dialog.showModal();dialog.querySelector('#close-reader-tools').onclick=()=>dialog.close();}
 function marks(){const list=loadReadingData().bookmarks.filter(m=>m.bookId===book.id&&!m.deletedAt).sort((a,b)=>a.chapter-b.chapter||a.paragraph-b.paragraph||a.offset-b.offset);return list;}
 function renderTools(){show(`<span class="eyebrow">YOUR READING COMPANION</span><h2>书签与搜索</h2><div class="reader-tool-actions"><button id="add-reader-bookmark" class="primary">添加当前位置书签</button><button data-shelf="${book.id}">${book.local?'已存入本地书架 ✓':'加入 / 移出书架'}</button><a class="secondary" href="#/library">全部书签与阅读历史 ↗</a></div><form id="book-search-form"><label for="book-search">搜索这部作品的正文与章节</label><div class="book-search-row"><input id="book-search" type="search" maxlength="120" placeholder="输入人物、情节或章节名" required><button type="submit">搜索全书</button></div></form><div id="book-search-results" aria-live="polite"></div><div class="section-heading"><h3>本书书签 <small>${marks().length}</small></h3></div><div id="reader-bookmarks">${bookmarkCards(marks(),[book])}</div><small>书签记录正文段落和文字位置；改变字号后仍可定位。作品更新导致文字改变时，会尽量找到附近位置。</small>`);
  dialog.querySelector('#add-reader-bookmark').onclick=()=>{add();renderTools();};
  const container=dialog.querySelector('#reader-bookmarks');bindBookmarkActions(container,{books:[book],refresh:()=>{container.innerHTML=bookmarkCards(marks(),[book]);dialog.querySelector('.section-heading small').textContent=marks().length;update();},toast,dialog:noteDialog});
  dialog.querySelector('#book-search-form').onsubmit=event=>{event.preventDefault();const query=dialog.querySelector('#book-search').value,{results,total}=searchBook(book,query);dialog.querySelector('#book-search-results').innerHTML=`<p>找到 ${total} 个匹配段落${total>results.length?'，显示前 '+results.length+' 条':''}</p>${results.map(result=>`<a class="book-search-result" href="${positionHref(book,result)}"><strong>${esc(result.chapterTitle)}</strong><span>${esc(result.excerpt)}</span></a>`).join('')}`;};
 }
 function add(){try{const position=(dialog.open?lastAnchor:capture())||lastAnchor;if(!position)return;const {created}=addBookmark(position);lastAnchor=position;update();toast(created?'已添加当前位置书签，可在「书签/搜索」中编辑备注':'这个位置已有书签');}catch(error){toast(error.message);}}
 dialog.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link?.hash===location.hash&&link.hash.includes('/at/')){event.preventDefault();const parts=link.hash.slice(2).split('/');dialog.close();restore({paragraph:Number(parts[4]),offset:Number(parts[5])},{flash:true});update();}},{signal:abort.signal});
 root.querySelector('#bookmark-current').onclick=add;root.querySelector('#reader-tools').onclick=()=>{lastAnchor=capture()||lastAnchor;renderTools();};
 root.querySelectorAll('.chapter-filter').forEach(input=>{input.oninput=()=>{const query=input.value.toLocaleLowerCase();input.closest('aside,.mobile-chapters').querySelectorAll('.reader-toc a').forEach(a=>a.hidden=!a.textContent.toLocaleLowerCase().includes(query));};});
 window.addEventListener('scroll',()=>{if(settings.mode!=='scroll'||!started)return;cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(update);},{passive:true,signal:abort.signal});
 window.addEventListener('pagehide',()=>{if(started&&root.isConnected)lastAnchor=capture()||lastAnchor;persist();},{signal:abort.signal});
 const parts=location.hash.slice(2).split('/'),data=loadReadingData(),entry=data.history[book.id];let requested=null;
 if(parts[3]==='at'){const mark=data.bookmarks.find(m=>m.id===parts[6]&&m.bookId===book.id);requested={paragraph:Number(parts[4])||0,offset:Number(parts[5])||0,excerpt:mark?.excerpt};}
 else if(parts[3]==='start')requested={paragraph:0,offset:0};
 else if(parts[3]!=='start'&&parts[3]!=='end'&&entry&&resolveChapter(book,entry)===n)requested=entry;
 requestAnimationFrame(()=>{if(!root.isConnected)return;if(parts[3]==='end')requested={paragraph:Math.max(0,ps.length-1),offset:Math.max(0,(ps.at(-1)?.textContent.length||1)-1)};if(requested)restore(requested,{flash:parts[3]==='at'});started=true;lastAnchor=capture();persist();update();if(['at','start','end'].includes(parts[3]))history.replaceState(null,'',`#/read/${book.id}/${n}`);});
 return {anchor:()=>started?lastAnchor:null,restore,changed:()=>{if(started){update();persist();}},dispose:()=>{abort.abort();clearTimeout(writeTimer);cancelAnimationFrame(scrollFrame);persist();dialog.close();noteDialog.close();}};
}
