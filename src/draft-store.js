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
async function write(value){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(value,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存被中断'));});}
export function storeDraft(value){const copy=structuredClone(value);const task=queue.catch(()=>{}).then(()=>write(copy));queue=task;return task;}
export async function loadDraft(){
 let legacy=null;try{legacy=JSON.parse(localStorage.getItem('wenxu-draft'));}catch{}
 try{const db=await database();const saved=await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readonly'),r=tx.objectStore('drafts').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(saved)return saved;if(legacy){await storeDraft(legacy);localStorage.removeItem('wenxu-draft');}return legacy;}catch{return legacy;}
}
