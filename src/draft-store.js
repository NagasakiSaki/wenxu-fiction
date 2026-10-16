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
async function transaction(change){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');change(tx.objectStore('drafts'));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存被中断'));});}
async function get(key){await queue.catch(()=>{});const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('drafts','readonly').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function write(value){const key=draftKey(value),updatedAt=Date.now(),summary={key,title:value.title||'未命名作品',author:value.author||'',chapters:value.chapters?.length||0,characters:value.chapters?.reduce((n,c)=>n+(c.body?.length||0),0)||0,updatedAt,trashed:false};await transaction(store=>{store.put(value,'current');store.put({value,updatedAt,trashed:false},'draft:'+key);store.put(summary,'summary:'+key);});}
export function storeDraft(value){const copy=structuredClone(value);const task=queue.catch(()=>{}).then(()=>write(copy));queue=task;return task;}
export async function loadDraft(){
 let legacy=null;try{legacy=JSON.parse(localStorage.getItem('wenxu-draft'));}catch{}
 try{const saved=await get('current');if(saved){if(!await get('summary:'+draftKey(saved)))await storeDraft(saved);return saved;}if(legacy){await storeDraft(legacy);localStorage.removeItem('wenxu-draft');}return legacy;}catch{return legacy;}
}
export async function listDrafts({trashed=false}={}){await queue.catch(()=>{});const db=await database();const summaries=await new Promise((resolve,reject)=>{const r=db.transaction('drafts','readonly').objectStore('drafts').getAll(IDBKeyRange.bound('summary:','summary:\uffff'));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return summaries.filter(s=>s.trashed===trashed).sort((a,b)=>b.updatedAt-a.updatedAt);}
export async function getDraft(key){const record=await get('draft:'+key);if(!record)throw Error('找不到这份草稿');return structuredClone(record.value);}
export function setDraftTrashed(key,trashed){const task=queue.catch(()=>{}).then(async()=>{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),r=store.get('draft:'+key),s=store.get('summary:'+key);r.onsuccess=()=>{if(r.result)store.put({...r.result,trashed},'draft:'+key);};s.onsuccess=()=>{if(s.result)store.put({...s.result,trashed},'summary:'+key);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});});queue=task;return task;}
