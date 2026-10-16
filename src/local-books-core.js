import {validateBook} from './model.js';
// Keep reading IDs stable across updates, separate from public IDs and editable drafts.
export function localReadingCopy(input,existing=[]){
 const source=input?.format==='wenxu-draft-v1'?input.draft:input;
 if(!source||typeof source!=='object')throw Error('请选择文序作品 JSON 或草稿备份');
 const sourceId=source.sourceId||source.id;
 if(typeof sourceId!=='string'||!/^[a-z0-9-]{3,80}$/.test(sourceId))throw Error('作品编号无效，请先在工作台检查');
 const old=existing.find(book=>book.sourceId===sourceId);
 const book=validateBook({id:old?.id||'local-'+crypto.randomUUID(),title:source.title||'未命名作品',author:source.author||'未署名',intro:source.intro??'',category:source.category||'其他',status:source.status||'连载中',chapters:structuredClone(source.chapters),updated:new Date().toISOString().slice(0,10)});
 return {...book,sourceId,local:true,draftKey:book.id};
}
export function portableBook(book){const {local,sourceId,draftKey,...value}=book;return {...value,id:sourceId||book.id};}
