// Immutable snapshots are written first; a single atomic manifest rename commits
// current draft + operation backup together. Files are app-private, not Cache.
export function createNativeDraftStore(io){
 let queue=Promise.resolve();
 const empty=()=>({version:1,current:null,entries:{}});
 async function manifest(){const raw=await io.read('drafts/index.json');if(raw===null)return empty();const value=JSON.parse(raw);if(value.version!==1||!value.entries||typeof value.entries!=='object'||Array.isArray(value.entries))throw Error('本机草稿索引损坏，请保留应用数据并使用导出备份恢复');return value;}
 async function readRecord(entry){if(!entry)throw Error('找不到这份本机草稿');if(!/^drafts\/snapshots\/[a-f0-9-]+\.json$/.test(entry.file))throw Error('本机草稿路径无效');const text=await io.read(entry.file);if(text===null)throw Error('本机草稿文件缺失，请从备份恢复');const value=JSON.parse(text);if(!Array.isArray(value.chapters))throw Error('本机草稿文件无效');return value;}
 function queued(task){const result=queue.catch(()=>{}).then(task);queue=result;return result;}
 function key(value){return value.draftKey||value.id||'legacy';}
 function store(value,backup){const next=structuredClone(value),previous=backup&&structuredClone(backup);return queued(async()=>{
  if(previous&&key(previous)===key(next))throw Error('备份需使用独立草稿编号');const index=await manifest(),changed=[...(previous?[previous]:[]),next],obsolete=[];
  for(const draft of changed){const id=key(draft),file=`drafts/snapshots/${crypto.randomUUID()}.json`,old=index.entries[id];await io.write(file,JSON.stringify(draft));if(old)obsolete.push(old.file);index.entries[id]={key:id,file,title:draft.title||'未命名作品',author:draft.author||'',chapters:draft.chapters.length,characters:draft.chapters.reduce((n,c)=>n+c.body.length,0),updatedAt:Date.now(),trashed:false};}
  index.current=key(next);await commit(index);
  for(const file of obsolete)if(!Object.values(index.entries).some(entry=>entry.file===file))await io.remove(file).catch(()=>{});
 });}
 async function commit(index){const temporary=`drafts/index-${crypto.randomUUID()}.tmp`;await io.write(temporary,JSON.stringify(index));await io.rename(temporary,'drafts/index.json');}
 async function ready(){await queue.catch(()=>{});return manifest();}
 return {
  storeDraft:value=>store(value),storeDraftWithBackup:(value,backup)=>store(value,backup),
  loadDraft:async()=>{const index=await ready();return index.current?readRecord(index.entries[index.current]):null;},
  getDraft:async id=>readRecord((await ready()).entries[id]),
  listDrafts:async({trashed=false}={})=>Object.values((await ready()).entries).filter(entry=>entry.trashed===trashed).sort((a,b)=>b.updatedAt-a.updatedAt).map(({file,...summary})=>summary),
  setDraftTrashed:(id,trashed)=>queued(async()=>{const index=await manifest();if(!index.entries[id])throw Error('找不到这份草稿');index.entries[id].trashed=trashed;await commit(index);}),
 };
}
