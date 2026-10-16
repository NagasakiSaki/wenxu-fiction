import {registerPlugin} from '@capacitor/core';
export const DocumentAccess=registerPlugin('DocumentAccess');
export async function pickNativeFolder(){
 const result=await DocumentAccess.pickFolder();if(result.cancelled)return [];
 const {Filesystem}=await import('@capacitor/filesystem');
 return result.files.map(file=>({name:file.name,size:file.size,webkitRelativePath:file.path,arrayBuffer:async()=>{const result=await Filesystem.readFile({path:file.uri});const binary=atob(result.data);if(binary.length>10*1024*1024)throw Error('文档超过10MB上限');return Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;}}));
}
