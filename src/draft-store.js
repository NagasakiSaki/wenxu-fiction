import {isNative} from './platform-runtime.js';
let nativeBackend;const nativeStore=()=>nativeBackend??=(import('./native-draft-store.js').then(module=>module.nativeDraftStore));
// Large manuscripts use IndexedDB instead of the small synchronous localStorage quota.
let opening,queue=Promise.resolve();
function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  const request=indexedDB.open('wenxu-manuscripts',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
  request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('草稿数据库被其他页面占用'));
  request.onsuccess=()=>resolve(request.result);
 });
 return opening;
}
export const draftKey=value=>value.draftKey||value.id||'legacy';
// 草稿结构版本：字段变化时提升，并在读取处按需迁移；缺失视为 1。
export const DRAFT_SCHEMA=2;
async function transaction(change){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存被中断'));try{change(tx.objectStore('drafts'));}catch(error){tx.abort();reject(error);}});}
async function get(key){await queue.catch(()=>{});const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('drafts','readonly').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function putDraft(store,value,updatedAt,{current=false}={}){const key=draftKey(value),summary={key,title:value.title||'未命名作品',author:value.author||'',chapters:value.chapters?.length||0,characters:value.chapters?.reduce((n,c)=>n+(c.body?.length||0),0)||0,updatedAt,trashed:false};if(current)store.put(value,'current');store.put({value,updatedAt,trashed:false},'draft:'+key);store.put(summary,'summary:'+key);}
async function write(value){await transaction(store=>putDraft(store,value,Date.now(),{current:true}));}
export function storeDraft(value){if(isNative())return nativeStore().then(store=>store.storeDraft(value));const copy=structuredClone(value);const task=queue.catch(()=>{}).then(()=>write(copy));queue=task;return task;}
export function storeDraftWithBackup(value,backup){if(isNative())return nativeStore().then(store=>store.storeDraftWithBackup(value,backup));const next=structuredClone(value),previous=structuredClone(backup);if(draftKey(next)===draftKey(previous))return Promise.reject(Error('备份需使用独立草稿编号'));const task=queue.catch(()=>{}).then(()=>transaction(store=>{putDraft(store,previous,Date.now());putDraft(store,next,Date.now(),{current:true});}));queue=task;return task;}
export async function loadDraft(){
 if(isNative())return (await nativeStore()).loadDraft();
 let legacy=null;try{legacy=JSON.parse(localStorage.getItem('wenxu-draft'));}catch{}
 try{const saved=await get('current');if(saved){if(!await get('summary:'+draftKey(saved)))await storeDraft(saved);return saved;}if(legacy){await storeDraft(legacy);localStorage.removeItem('wenxu-draft');}return legacy;}catch{return legacy;}
}
export async function listDrafts({trashed=false}={}){if(isNative())return (await nativeStore()).listDrafts({trashed});await queue.catch(()=>{});const db=await database();const summaries=await new Promise((resolve,reject)=>{const r=db.transaction('drafts','readonly').objectStore('drafts').getAll(IDBKeyRange.bound('summary:','summary:\uffff'));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return summaries.filter(s=>s.trashed===trashed).sort((a,b)=>b.updatedAt-a.updatedAt);}
export async function getDraft(key){if(isNative())return (await nativeStore()).getDraft(key);const record=await get('draft:'+key);if(!record)throw Error('找不到这份草稿');return structuredClone(record.value);}
export function setDraftTrashed(key,trashed){if(isNative())return nativeStore().then(store=>store.setDraftTrashed(key,trashed));const task=queue.catch(()=>{}).then(async()=>{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),r=store.get('draft:'+key),s=store.get('summary:'+key);r.onsuccess=()=>{if(r.result)store.put({...r.result,trashed},'draft:'+key);};s.onsuccess=()=>{if(s.result)store.put({...s.result,trashed},'summary:'+key);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});});queue=task;return task;}
// 网页端可以真正删除一份草稿及其摘要；安卓端走回收站（原生没有永久删除接口）。
export function deleteDraft(key,{permanent=true}={}){
 if(isNative())return setDraftTrashed(key,true).then(()=>false);
 const task=queue.catch(()=>{}).then(async()=>{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts');if(permanent){store.delete('draft:'+key);store.delete('summary:'+key);}else{const s=store.get('summary:'+key);s.onsuccess=()=>{if(s.result)store.put({...s.result,trashed:true},'summary:'+key);};}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});});queue=task;return task.then(()=>true);}
