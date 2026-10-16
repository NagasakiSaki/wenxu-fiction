import {isNative} from './platform-runtime.js';
export async function exportJsonFile(filename,value){
 const safeName=filename.replace(/[^\w\u4e00-\u9fff.\-]/g,'_').slice(0,160),text=JSON.stringify(value,null,2);
 if(isNative()){
  const {DocumentAccess}=await import('./native-documents.js');const result=await DocumentAccess.saveText({filename:safeName,text});return result.cancelled?'已取消导出':'文件已保存到所选位置，可传送到另一台设备';
 }
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=safeName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);return '已生成下载文件';
}
