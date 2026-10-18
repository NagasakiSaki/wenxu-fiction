import {refreshSections} from './chapter-hierarchy.js';
import {workHealthMarkup} from './work-health.js';
import {chapterLinks} from './chapter-toc.js';
import {loadLocalBooks,storeLocalBook} from './local-books.js';
import {localReadingCopy,portableBook} from './local-books-core.js';
import './local-app.css';
import {localAppMarkup,bindLocalApp,initLocalApp} from './local-app.js';
import {exportJsonFile,exportTextFile} from './file-export.js';
import {bookToText,bookToMarkdown,normalizeChapterTitles,exportFilename} from './book-export.js';
import {isNative} from './platform-runtime.js';
import './style.css';
import './import.css';
import './structure-review.css';
import './chapter-edit.css';
import './smart-split.css';
import './woodcut.css';
import {chapterEditMarkup,bindChapterEdits} from './chapter-edit-ui.js';
import {smartSplitMarkup,bindSmartSplit} from './smart-split-ui.js';
import {sourceStats,withoutImportSource} from './draft-source.js';
import {applySkin,loadSkin,nextSkin,saveSkin,skinLabel} from './theme.js';
import './experience.css';
import './studio-simple.css';
import './paged-reading.css';
import './reading-tools.css';
import {loadReadingData,positionHref} from './reading-data.js';
import {readingDashboard,readingLibraryMarkup,bindReadingLibrary} from './reading-library.js';
import {draftKey,listDrafts,deleteDraft,DRAFT_SCHEMA} from './draft-store.js';
import {formatBytes,usageLevel,selectBackups,BACKUP_LIMIT,isBackup} from './storage-health.js';
import {newDraftKey,clearedDraftWithBackup,openDraftManager,downloadDraft,parseDraftBackup} from './draft-manager.js';
import {readerSettings,readerMarkup,bindReader} from './reader-controls.js';
import {loadDraft,storeDraft,storeDraftWithBackup} from './draft-store.js';
import {validateBook,countWords,OWNER,REPO} from './model.js';
import {bindDocumentImports} from './import-ui.js';
const modules=import.meta.glob('../content/books/*.json',{eager:true,import:'default'});
const publicBooks=Object.values(modules).map(validateBook).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
let localBooks=await loadLocalBooks().catch(error=>{setTimeout(()=>toast('本地书架读取失败：'+error.message),0);return [];});
let books=[...localBooks,...publicBooks];
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback){try{return JSON.parse(localStorage.getItem('wenxu-'+key))??fallback;}catch{return fallback;}}
let draftDirty=false;
function save(key,value){if(key==='draft')return storeDraft(value).then(()=>{if(value===draft)draftDirty=false;return true;}).catch(()=>{toast('本机草稿保存失败，请立即导出作品文件备份');return false;});try{localStorage.setItem('wenxu-'+key,JSON.stringify(value));return true;}catch{toast('本机存储空间不足，请导出备份');return false;}}
let shelf=read('shelf',[]),progress=read('progress',{}),settings=readerSettings(read('settings',{size:20,night:false})),draft=await loadDraft().catch(error=>{setTimeout(()=>toast('草稿读取失败：'+error.message),0);return null;}),selected=0,query='',category='全部',sort='new',onlyShelf=false;
document.documentElement.classList.toggle('night',settings.night);applySkin(loadSkin());
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
const icon='<span class="brand-icon">文</span>';
function shell(content){document.body.classList.remove('is-paged-reading');$('#app').innerHTML=`<header><a class="brand" href="#/">${icon}文序<span>WENXU</span><span class="woodcut-seal" aria-hidden="true">文序</span></a><nav><a href="#/">发现故事</a><a href="#/shelf">我的书架</a><a class="reading-library-link" href="#/library">书签与历史</a><a class="local-app-nav" href="#/app">本地应用</a><a class="write-link" href="#/studio">作者工作台 ↗</a></nav></header>${content}<footer><a class="brand" href="#/">${icon}文序</a><p>让每个故事，都有下一章。</p><span><a href="https://github.com/NagasakiSaki/wenxu-fiction" target="_blank" rel="noopener">NagasakiSaki 的项目 ↗</a> · <a href="#/app">本地应用与文件互通</a></span><button data-action="skin">${skinLabel(loadSkin())}</button><button data-action="theme">${settings.night?'日间':'夜间'}模式 ◐</button></footer>`;}
function cover(b,i=0){return `<div class="cover cover-${i%4}"><span>文序原创 / ${esc(b.category)}</span><strong>${esc(b.title)}</strong><i></i><small>${esc(b.author)} 著</small></div>`;}
function card(b,i){return `<a class="book-card" href="#/book/${encodeURIComponent(b.id)}">${cover(b,i)}<div><small>${esc(b.category)} · ${esc(b.status)}${b.local?' · 本地离线':b.demo?' · 体验作品':''}</small><h3>${esc(b.title)}</h3><p>${esc(b.intro)}</p><span>${esc(b.author)}<b>${b.chapters.length} 章 · ${countWords(b).toLocaleString()} 字</b></span></div></a>`;}
function home(){onlyShelf=location.hash==='#/shelf';shell(`<main>${onlyShelf?'<section class="section-heading"><div><span class="eyebrow">YOUR PRIVATE SHELF</span><h1>留一页，给下次相遇。</h1><p>本地作品全文保存在本机，断网也能阅读。编辑草稿后需再次更新书架副本。</p><div class="actions"><label class="secondary file-button">导入作品到本地书架<input id="shelf-import" type="file" accept=".json"></label><a class="primary" href="#/studio">整理手稿并加入书架 →</a></div><small>支持文序作品 JSON / 草稿备份；TXT、Word、PDF 请先在工作台自动分章。</small></div></section>':`<section class="hero"><div><span class="eyebrow">一个故事的开始 / WENXU READING</span><h1>世界很大，<br>故事<span>未完。</span></h1><p>在文字里，遇见另一种人生。<br>寻找值得停留的故事，也写下属于你的下一章。</p><a class="primary" href="#library">翻开一本书 <span>↗</span></a><div class="hero-note"><span>01 /</span> 从这里，读向远方</div></div><a class="hero-art" href="#/book/${publicBooks[0]?.id||''}"><span class="orb"></span><div class="paper paper-back"></div><div class="paper"><small>THE STORY GOES ON</small><h2>在字里行间<br>重逢世界</h2><div class="paper-lines"></div><span>文序 · 阅读计划<br>VOL. 001</span></div><span class="art-caption">每一页，都是新的抵达。</span></a></section><section class="manifest"><span>不必走遍世界，也能经历万千人生。</span><b>${publicBooks.length} 部作品</b><b>${publicBooks.reduce((n,b)=>n+b.chapters.length,0)} 个章节</b><span>开放阅读，无需登录 ↗</span></section>`}${readingDashboard(books)}<section id="library"><div class="section-heading"><div><span class="eyebrow">${onlyShelf?'BOOKMARKED STORIES':'THE READING ROOM'}</span><h2>${onlyShelf?'我的书架':'故事书库'}<em> / 随时翻开，慢慢读</em></h2></div><label class="search">⌕ <input id="search" type="search" placeholder="搜索书名、作者、简介" value="${esc(query)}" aria-label="搜索作品"></label></div><div class="filters"><div>${['全部',...new Set(books.map(b=>b.category))].map(c=>`<button class="${category===c?'active':''}" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><select id="sort" aria-label="排序"><option value="new">最近更新</option><option value="length" ${sort==='length'?'selected':''}>字数最多</option><option value="complete" ${sort==='complete'?'selected':''}>完结优先</option></select></div><div id="results"></div></section><section class="author-banner"><div><span class="eyebrow">FOR THE STORYTELLERS</span><h2>你的故事，值得被看见。</h2><p>导入文档，自动分章。从一份手稿，到一本可以阅读的书。</p></div><a href="#/studio" class="primary">开始创作 ↗</a></section></main>`);renderResults();if($('#shelf-import'))$('#shelf-import').onchange=importShelfFile;$('#search').oninput=e=>{query=e.target.value;renderResults();};$('#sort').onchange=e=>{sort=e.target.value;renderResults();};}
function renderResults(){let list=books.filter(b=>(onlyShelf?(b.local||shelf.includes(b.id)):!b.local)&&(category==='全部'||b.category===category)&&[b.title,b.author,b.intro].join(' ').toLowerCase().includes(query.toLowerCase()));if(sort==='length')list.sort((a,b)=>countWords(b)-countWords(a));if(sort==='complete')list.sort((a,b)=>(b.status==='已完结')-(a.status==='已完结'));$('#results').innerHTML=list.length?`<div class="book-grid">${list.map(card).join('')}</div>`:'<div class="empty">这里还没有故事。<p>试试其他搜索条件，或导入作品到本地书架。</p></div>';}
function resumeLink(book){const entry=loadReadingData().history[book.id];return entry?positionHref(book,entry):'#/read/'+book.id+'/'+Math.min(progress[book.id]||0,book.chapters.length-1);}
function detail(id){const b=books.find(b=>b.id===id);if(!b)return missing();shell(`<main><a href="${b.local?'#/shelf':'#/'}" class="back">← ${b.local?'返回本地书架':'返回书库'}</a><section class="book-detail">${cover(b,books.indexOf(b))}<div><span class="eyebrow">${esc(b.category)} / ${esc(b.status)}${b.demo?' / 原创体验短篇':''}</span><h1>${esc(b.title)}</h1><p class="byline">${esc(b.author)} 著 · ${b.chapters.length} 章 · ${countWords(b)} 字</p><p>${esc(b.intro)}</p><div class="actions"><a class="primary" href="${resumeLink(b)}">${progress[b.id]!==undefined||loadReadingData().history[b.id]?'继续阅读':'开始阅读'} →</a><button data-shelf="${b.id}">${b.local?'已存入本地书架 ✓':shelf.includes(b.id)?'已加入书架 ✓':'加入书架 +'}</button>${b.local?`<button data-local-export="${b.id}">导出作品文件</button>`:''}</div><small>更新于 ${esc(b.updated||'未知')} · 免费全文阅读</small></div></section><section><div class="section-heading"><h2>作品目录 <em>/ 共 ${b.chapters.length} 章</em></h2></div><div class="chapter-grid">${chapterLinks(b,esc,{grid:true})}</div></section></main>`);}
function reader(id,index){const b=books.find(b=>b.id===id),n=Number(index);if(!b||!Number.isInteger(n)||!b.chapters[n])return missing();progress[id]=n;save('progress',progress);shell(readerMarkup(b,n,{settings,esc,inShelf:shelf.includes(id)}));bindReader({book:b,n,settings,saveSettings:next=>save('settings',next),toast});}
function missing(){shell('<main class="empty"><h1>这一页还没有写下。</h1><a href="#/">返回书库</a></main>');}
function fresh(){return {draftKey:newDraftKey(),schemaVersion:DRAFT_SCHEMA,id:'story-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,6),title:'',author:'',category:'奇幻',intro:'',status:'连载中',chapters:[{title:'第一章',body:''}]};}
function restoreStudioToc(scrollTop){
 const toc=$('.editor-toc'),active=toc?.querySelector('.active');
 if(!toc||!active)return;
 toc.scrollTop=scrollTop;
 const bounds=toc.getBoundingClientRect(),item=active.getBoundingClientRect();
 const top=bounds.top+toc.clientTop,bottom=top+toc.clientHeight;
 // Scroll only the chapter list; keep an already visible selection in place.
 if(item.top<top)toc.scrollTop+=item.top-top;
 else if(item.bottom>bottom)toc.scrollTop+=item.bottom-bottom;
}
function studio(){const tocScrollTop=$('.editor-toc')?.scrollTop??0;draft||=fresh();selected=Math.max(0,Math.min(selected,draft.chapters.length-1));shell(`<main><div class="section-heading"><div><span class="eyebrow">AUTHOR'S STUDIO</span><h1>让手稿，成为故事。</h1><p>导入 → 校正章节 → 加入本地书架，断网也能读。草稿与阅读副本分别保存。</p></div><a class="text-link" href="https://github.com/${OWNER}/${REPO}/tree/main/content/books" target="_blank" rel="noopener">管理已发布作品 ↗</a></div><section class="draft-launcher"><div><h2>我的草稿箱</h2><p>多部作品独立保存，随时继续上次创作。草稿仅存${isNative()?'本机应用':'当前浏览器'}。</p></div><div><button data-action="draft-box">打开草稿箱</button><button data-action="new">新建作品 ＋</button><button data-action="draft-export">备份当前草稿</button><details class="studio-disclosure"><summary>导出与存储</summary><div class="studio-option-row"><button data-action="export-text">导出 TXT / Markdown</button><button data-action="storage">本机存储</button></div></details></div></section><section class="import-panel"><div><strong>↥ 导入你的手稿</strong><p>Word / TXT / Markdown / 文字型 PDF · 单文件 10 MB · 一批最多 100 个文档</p></div><label class="primary file-button">选择文档（可多选）<input id="document" type="file" multiple accept=".docx,.txt,.md,.markdown,.pdf"></label><details class="studio-disclosure import-advanced"><summary>文件夹、恢复与导入选项</summary><div class="studio-option-row">${isNative()?'<button class="secondary" id="native-folder">选择整个文件夹</button>':'<label class="secondary file-button">选择整个文件夹<input id="folder" type="file" webkitdirectory multiple></label>'}<label class="secondary file-button">恢复作品文件<input id="restore" type="file" accept=".json"></label><label class="import-mode">导入方式<select id="import-mode"><option value="append">追加到现有章节末尾</option><option value="replace">替换当前全部章节</option></select></label></div></details><p id="import-status" role="status">选择文档后自动分章，核对结果再确认导入。扫描 PDF 需先转为文字。</p></section>${smartSplitMarkup({chapters:draft.chapters,characters:draft.chapters.reduce((n,c)=>n+c.body.length,0),source:sourceStats(draft)})}<section class="studio-grid"><div class="manuscript"><details class="studio-disclosure work-info"><summary>作品信息</summary><div class="form-grid"><label>书名<input data-field="title" maxlength="100" value="${esc(draft.title)}" placeholder="给故事一个名字"></label><label>作者笔名<input data-field="author" maxlength="60" value="${esc(draft.author)}" placeholder="你的笔名"></label><label>分类<select data-field="category">${['奇幻','科幻','悬疑','都市','言情','历史','武侠','其他'].map(c=>`<option ${draft.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>状态<select data-field="status"><option>连载中</option><option ${draft.status==='已完结'?'selected':''}>已完结</option></select></label></div><label>作品简介<textarea data-field="intro" rows="3" maxlength="1000" placeholder="让读者认识这个故事">${esc(draft.intro)}</textarea></label><label>作品编号 <small>更新同一作品时保留编号</small><input data-field="id" value="${esc(draft.id)}" pattern="[a-z0-9-]{3,80}"></label></details><div class="section-heading"><h2>章节 <em>${draft.chapters.length}</em></h2><div class="studio-chapter-tools"><button data-action="add">＋ 新增</button><button data-action="work-health">整书结构体检</button><button class="clear-chapters" data-action="clear-chapters">清空全部章节</button></div></div><div class="editor-toc">${draft.chapters.map((c,i)=>`<button data-chapter="${i}" class="${i===selected?'active':''}"><span>${String(i+1).padStart(2,'0')}</span>${esc(c.title||'未命名章节')}</button>`).join('')}</div></div>${draft.chapters.length?`<div class="editor"><div class="editor-actions"><span>章节 ${selected+1}</span><button data-action="up" ${selected===0?'disabled':''}>上移 ↑</button><button data-action="down" ${selected===draft.chapters.length-1?'disabled':''}>下移 ↓</button><button data-action="delete" ${draft.chapters.length===1?'disabled':''}>删除</button></div><label>章节标题<input id="chapter-title" maxlength="100" value="${esc(draft.chapters[selected].title)}"></label>${chapterEditMarkup()}<label>正文<textarea id="chapter-body" rows="22" placeholder="故事从这里开始……">${esc(draft.chapters[selected].body)}</textarea></label><div class="editor-bottom"><span id="word-count">${draft.chapters[selected].body.length} 字符</span><button data-action="preview">预览本章 ↗</button></div></div>`:`<div class="editor empty"><h2>还没有章节</h2><p>可以导入文档自动分章，也可以手动创建第一章。</p><button data-action="add">创建第一章 ＋</button></div>`}</section><div class="publish-bar"><span id="save-status">草稿保存在${isNative()?'本机应用':'当前浏览器'}</span><div><button data-action="save">保存草稿</button><button data-action="publish">发布到公开网站</button><button class="primary" data-action="local-publish">存入本地书架并阅读 →</button></div></div></main><dialog id="dialog"></dialog>`);restoreStudioToc(tocScrollTop);bindDocumentImports({getDraft:()=>draft,apply:async(next,index)=>{clearTimeout(autoSaveTimer);draft=next;selected=index;const stored=await save('draft',draft);studio();return stored;},modal,esc,toast});bindSmartSplit({getDraft:()=>draft,commit:async(next,index,backup)=>{clearTimeout(autoSaveTimer);await storeDraftWithBackup(next,backup);draft=next;draftDirty=false;selected=index;studio();},modal,esc,toast});bindChapterEdits({getDraft:()=>draft,getSelected:()=>selected,onChange:queueAutoSave,commit:async(next,index,backup)=>{clearTimeout(autoSaveTimer);await storeDraftWithBackup(next,backup);draft=next;draftDirty=false;selected=index;studio();const editor=$('#chapter-body');editor?.focus();editor?.setSelectionRange(0,0);},modal,esc,toast});$('#restore').onchange=restoreFile;document.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>{draft[el.dataset.field]=el.value;});if($('#chapter-title'))$('#chapter-title').oninput=e=>{draft.chapters[selected].title=e.target.value;};if($('#chapter-body'))$('#chapter-body').oninput=e=>{draft.chapters[selected].body=e.target.value;$('#word-count').textContent=e.target.value.length+' 字符';};}
async function activateDraft(next){clearTimeout(autoSaveTimer);if(draft&&draftKey(draft)!==draftKey(next))await storeDraft(draft);await storeDraft(next);draft=next;draftDirty=false;selected=0;studio();}
async function createDraft(){await activateDraft(fresh());toast('已新建作品，原草稿保留在草稿箱');}
async function clearChapters(){if(!draft.chapters.length)return toast('当前没有章节');const original=draft;modal(`<span class="eyebrow">MANUSCRIPT RESET</span><h2>清空当前全部章节？</h2><p>将清空当前作品的 <strong>${draft.chapters.length}</strong> 章。系统会先在草稿箱建立「清空前备份」，书名、作者和简介会保留。</p><div class="actions"><button class="clear-chapters" id="confirm-clear">确认清空全部章节</button><button data-action="close">取消，保留章节</button></div>`);$('#confirm-clear').onclick=async()=>{if(draft!==original)return toast('草稿已切换，请重新操作');$('#confirm-clear').disabled=true;try{clearTimeout(autoSaveTimer);const {backup,cleared:next}=clearedDraftWithBackup(draft);await storeDraft(backup);await storeDraft(next);draft=next;selected=0;studio();toast('已清空全部章节，备份已保存在草稿箱');}catch(err){toast('清空未完成：'+err.message);if($('#confirm-clear'))$('#confirm-clear').disabled=false;}};}
async function restoreFile(e){try{const f=e.target.files[0];if(!f)return;if(f.size>32*1024*1024)throw Error('草稿文件超过32MB，请减少附加资料后重试');const value=JSON.parse(await f.text());const next=value.format==='wenxu-draft-v1'?parseDraftBackup(value):{...validateBook(value),draftKey:newDraftKey()};await activateDraft(next);toast('已恢复作品，原草稿已保留在草稿箱');}catch(err){toast('恢复失败：'+err.message);}}
let autoSaveTimer;
function queueAutoSave(){draftDirty=true;clearTimeout(autoSaveTimer);const current=draft;autoSaveTimer=setTimeout(async()=>{const saved=await save('draft',current);if(saved&&draft===current&&$('#save-status'))$('#save-status').textContent='已自动保存 · '+new Date().toLocaleTimeString();},700);}
document.addEventListener('input',e=>{if(location.hash==='#/studio'&&e.target.matches('[data-field],#chapter-title,#chapter-body'))queueAutoSave();});
function modal(html){$('#dialog').innerHTML=`<button class="close" data-action="close" aria-label="关闭">×</button>${html}`;$('#dialog').showModal();}
let publishingLocal=false;
async function publishLocal(source){
 if(publishingLocal)return;publishingLocal=true;try{
 const book=localReadingCopy(source,localBooks);
 clearTimeout(autoSaveTimer);
 if(source===draft){await storeDraft(draft);draftDirty=false;}
 await storeLocalBook(book);
 localBooks=[book,...localBooks.filter(item=>item.id!==book.id)];books=[...localBooks,...publicBooks];
 category='全部';query='';location.hash='/book/'+book.id;
 toast('作品已存入本地书架，可断网阅读；没有上传到网络');
 }finally{publishingLocal=false;}
}
async function importShelfFile(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>32*1024*1024)throw Error('作品文件不能超过 32 MB');const source=JSON.parse(await file.text());const book=localReadingCopy(source,localBooks);if(localBooks.some(item=>item.id===book.id)){shell(`<main><h1>更新本地书架中的同编号作品？</h1><p>新文件：${esc(book.title)} · ${book.chapters.length} 章。书签和进度保留，阅读正文会替换为新版本；请先导出旧版以留存。</p><div class="actions"><button id="confirm-local-update" class="primary">确认更新本地副本</button><button id="cancel-local-update">返回书架</button></div></main>`);$('#cancel-local-update').onclick=home;$('#confirm-local-update').onclick=async()=>{try{await publishLocal(source);}catch(error){toast(error.message);}};}else await publishLocal(source);}catch(error){toast('导入失败：'+error.message);}finally{event.target.value='';}}
function exported(){if(!draft.title?.trim()||!draft.author?.trim()){const info=$('.work-info');if(info)info.open=true;document.querySelector(!draft.title?.trim()?'[data-field=title]':'[data-field=author]')?.focus();}validateBook(draft);const {draftKey:localDraftKey,chapterProfiles:privateProfiles,importNotes:privateImportNotes,...book}=withoutImportSource(draft);return {...book,chapters:book.chapters.map(({pendingBreakpoints,...chapter})=>refreshSections(chapter)),updated:new Date().toISOString().slice(0,10)};}
async function storageSnapshot(){
 try{if(navigator.storage?.estimate){const {usage=0,quota=0}=await navigator.storage.estimate();return {usage,quota};}}catch{}
 return {usage:0,quota:0};
}
async function openStoragePanel(){
 let summaries=[];try{summaries=await listDrafts();}catch(error){toast('草稿列表读取失败：'+error.message);return;}
 const {usage,quota}=await storageSnapshot();
 const {ratio,level}=usageLevel(usage,quota);
 const {remove}=selectBackups(summaries,{limit:BACKUP_LIMIT,keepKeys:[draftKey(draft)]});
 const characters=summaries.reduce((sum,item)=>sum+(item.characters||0),0);
 const tone=level==='full'?'smart-danger':level==='warn'?'smart-warn':'';
 modal(`<div class="smart-dialog"><span class="eyebrow">LOCAL STORAGE</span><h2>本机存储</h2>
 <p>草稿、操作前备份与阅读副本都保存在这台设备。本机存储不是云备份，清理浏览器数据或卸载应用会一并删除。</p>
 <ul class="storage-facts">
  <li><span>已用空间</span><strong class="${tone}">${quota?`${formatBytes(usage)} / ${formatBytes(quota)}（${Math.round(ratio*100)}%）`:'浏览器未提供配额信息'}</strong></li>
  <li><span>草稿</span><strong>${summaries.length} 部 · ${characters.toLocaleString()} 字</strong></li>
  <li><span>操作前备份</span><strong>${summaries.filter(isBackup).length} 份${remove.length?` · 可清理 ${remove.length} 份`:''}</strong></li>
 </ul>
 <p class="smart-hint">${level==='full'?'空间接近上限：建议先导出备份，再清理旧备份。':level==='warn'?'空间使用较多：可以清理较早的“操作前备份”。':'空间充足。'}保留最近 ${BACKUP_LIMIT} 份操作前备份，更早的可以清理；当前草稿不会被清理。</p>
 <div class="actions"><button class="primary" id="storage-prune" ${remove.length?'':'disabled'}>清理旧备份（${remove.length} 份）</button><button data-action="draft-box">草稿箱</button><button data-action="close">关闭</button></div>
 <p class="smart-hint">${isNative()?'安卓端清理会把这些备份移入回收站并释放不了多少空间，彻底释放请在系统设置中清除应用数据（会丢失全部本机内容）。':'清理会永久删除这些备份，不能恢复。'}</p></div>`);
 const prune=$('#storage-prune');
 if(prune)prune.onclick=async()=>{prune.disabled=true;try{
  let cleaned=0;
  for(const item of remove){await deleteDraft(item.key);cleaned++;}
  toast(`已清理 ${cleaned} 份旧备份`);
  await openStoragePanel();
 }catch(error){prune.disabled=false;toast('清理失败：'+error.message);}};
}
function openTextExport(){
 const source=draft;
 modal(`<div class="smart-dialog"><span class="eyebrow">EXPORT AS TEXT</span><h2>导出可编辑的文本</h2>
 <p>生成 TXT 或 Markdown，方便继续在别的编辑器里修改；也可以顺便把章名编号统一成一种写法。文件只保存在你选择的位置，不会上传。</p>
 <label>格式<select id="text-format"><option value="txt">TXT 纯文本</option><option value="md">Markdown</option></select></label>
 <label class="text-inline"><input type="checkbox" id="text-normalize"> 统一章名为 <select id="text-style"><option value="chinese">第一章</option><option value="arabic">第1章</option></select></label>
 <label class="text-inline"><input type="checkbox" id="text-writeback"> 同时写回当前草稿（先在草稿箱备份）</label>
 <p class="smart-hint" id="text-export-note"></p>
 <div class="actions"><button class="primary" id="text-export-run">导出</button><button data-action="close">取消</button></div></div>`);
 function refresh(){
  const checked=$('#text-normalize').checked;
  if(!checked){$('#text-export-note').textContent='';return;}
  const {changes,skipped}=normalizeChapterTitles(source.chapters,{style:$('#text-style').value});
  $('#text-export-note').textContent=changes.length?`将调整 ${changes.length} 个章名${skipped?`；${skipped} 个英文标题保持不变`:''}。例如：${changes[0].before} → ${changes[0].after}`:'章名已经统一，无需调整。';
 }
 $('#text-normalize').onchange=refresh;$('#text-style').onchange=refresh;refresh();
 $('#text-export-run').onclick=async()=>{const button=$('#text-export-run');button.disabled=true;try{
  if(draft!==source)throw Error('草稿已切换，请重新打开导出');
  const style=$('#text-style').value;
  const normalized=$('#text-normalize').checked?normalizeChapterTitles(source.chapters,{style}):{chapters:source.chapters,changes:[]};
  const format=$('#text-format').value;
  const book={...source,chapters:normalized.chapters};
  const text=format==='md'?bookToMarkdown(book):bookToText(book);
  if($('#text-writeback').checked&&normalized.changes.length){
   clearTimeout(autoSaveTimer);
   const backup={...structuredClone(source),draftKey:newDraftKey(),title:`${source.title||'未命名作品'} · 章名整理前备份`.slice(0,100)};
   const next={...source,chapters:normalized.chapters};
   await storeDraftWithBackup(next,backup);
   draft=next;draftDirty=false;studio();
  }
  toast(await exportTextFile(exportFilename(book,format==='md'?'md':'txt'),text,{mime:format==='md'?'text/markdown':'text/plain'}));
 }catch(error){button.disabled=false;toast(error.message);}};
}
async function download(){const b=exported();return exportJsonFile(b.id+'.json',b);}
document.addEventListener('click',async e=>{const el=e.target.closest('button,[data-category]');if(!el)return;try{if(el.dataset.localExport){const book=books.find(b=>b.id===el.dataset.localExport);toast(await exportJsonFile(book.sourceId+'.json',portableBook(book)));return;}if(el.dataset.category){category=el.dataset.category;home();return;}if(el.dataset.shelf){const id=el.dataset.shelf;if(books.find(b=>b.id===id)?.local){toast('作品全文已保存在本机，可从我的书架离线阅读');return;}shelf=shelf.includes(id)?shelf.filter(x=>x!==id):[...shelf,id];save('shelf',shelf);el.textContent=shelf.includes(id)?'已加入书架 ✓':'加入书架 +';return;}if(el.dataset.chapter!==undefined){selected=+el.dataset.chapter;studio();return;}switch(el.dataset.action){case'work-health':modal(`<span class="eyebrow">MANUSCRIPT HEALTH</span><h2>全文结构体检</h2>${workHealthMarkup(draft.chapters,esc,{interactive:true})}<p>本页检查编号、篇幅和重复正文。需要从原始文档学习标题或核对目录时，请在导入预览选择“检查 / 校正分章”。</p><button data-action="close">返回编辑</button>`);document.querySelectorAll('[data-health-chapter]').forEach(button=>button.onclick=()=>{selected=Number(button.dataset.healthChapter);studio();$('#chapter-body')?.focus();});break;case'local-publish':await publishLocal(draft);break;case'new':await createDraft();break;case'draft-box':await openDraftManager({current:draft,activate:activateDraft,create:createDraft,modal,esc,toast});break;case'draft-export':toast(await downloadDraft(draft));break;case'export-text':openTextExport();break;case'storage':await openStoragePanel();break;case'clear-chapters':await clearChapters();break;case'theme':settings.night=!settings.night;save('settings',settings);document.documentElement.classList.toggle('night',settings.night);document.querySelectorAll('[data-action=theme]').forEach(b=>b.textContent=(settings.night?'日间模式':'夜间模式')+' ◐');break;case'add':draft.chapters.push({title:`第 ${draft.chapters.length+1} 章`,body:''});selected=draft.chapters.length-1;studio();queueAutoSave();break;case'up':case'down':{const to=selected+(el.dataset.action==='up'?-1:1);if(to<0||to>=draft.chapters.length)return;[draft.chapters[selected],draft.chapters[to]]=[draft.chapters[to],draft.chapters[selected]];selected=to;studio();queueAutoSave();break;}case'delete':if(confirm('确定删除这一章？此操作会移除当前草稿中的正文。')){draft.chapters.splice(selected,1);studio();queueAutoSave();}break;case'save':if(await save('draft',draft)){$('#save-status').textContent='已保存到当前浏览器 · '+new Date().toLocaleTimeString();toast('草稿已保存');}break;case'preview':modal(`<span class="eyebrow">章节预览 · 尚未发表</span><h2>${esc(draft.chapters[selected].title)}</h2><div class="preview-text">${esc(draft.chapters[selected].body)}</div>`);break;case'skin':{const skin=nextSkin(loadSkin());saveSkin(skin);applySkin(skin);document.querySelectorAll('[data-action=skin]').forEach(b=>b.textContent=skinLabel(skin));break;}case'close':$('#dialog').close();break;case'publish':exported();save('draft',draft);modal(`<span class="eyebrow">PUBLISH YOUR STORY</span><h2>把故事交给读者。</h2><p>当前作品共 ${draft.chapters.length} 章，${countWords(draft).toLocaleString()} 字。导出不会立即公开。</p><ol><li>下载作品文件 <strong>${esc(draft.id)}.json</strong>。</li><li>打开 GitHub 上传页面，使用 <strong>${OWNER}</strong> 账号登录，上传此文件。更新作品时使用相同文件名。</li><li>点击 <strong>Commit changes</strong> 提交到 main。部署检查成功后，公开书库会自动更新，通常需要几分钟。</li></ol><div class="actions"><button class="primary" data-action="download">① 下载作品文件</button><a class="secondary" href="https://github.com/${OWNER}/${REPO}/upload/main/content/books" target="_blank" rel="noopener">② 前往 GitHub 上传 ↗</a></div><p><a target="_blank" rel="noopener" href="https://github.com/${OWNER}/${REPO}/actions">查看部署进度 ↗</a> · 发布完成后刷新书库即可看到更新。</p><small>只有仓库作者可以发布。草稿和文件在提交前不会发送到服务器。已公开文件和历史提交可被访问，请只提交可公开内容。</small>`);break;case'download':toast(await download());break;}}catch(err){toast(err.message);}});
function route(){const parts=location.hash.slice(2).split('/');if(parts[0]==='studio')studio();else if(parts[0]==='app'){shell(localAppMarkup());bindLocalApp({toast});}else if(parts[0]==='library'){shell(readingLibraryMarkup(books));bindReadingLibrary({books,toast,rerender:route});}else if(parts[0]==='book')detail(parts[1]);else if(parts[0]==='read')reader(parts[1],parts[2]);else home();if(location.hash==='#library')$('#library')?.scrollIntoView();else window.scrollTo(0,0);}
window.addEventListener('hashchange',()=>{if(draft&&draftDirty)save('draft',draft);route();});window.addEventListener('beforeunload',()=>{if(draft&&draftDirty)save('draft',draft);});if(isNative()&&!location.hash)history.replaceState(null,'','#/shelf');route();initLocalApp({toast,save:async()=>{clearTimeout(autoSaveTimer);if(draft){await storeDraft(draft);draftDirty=false;}}});
