import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {createNativeDraftStore} from './native-store-core.js';
// Independent manifest and immutable files: shelf updates cannot change drafts.
const pathOf=path=>path.replace(/^drafts\//,'books/');
export const nativeLocalBooks=createNativeDraftStore({
 read:async path=>{try{return (await Filesystem.readFile({path:pathOf(path),directory:Directory.Data,encoding:Encoding.UTF8})).data;}catch(error){if(/does not exist|not exist|not found|no such file/i.test(error.message||''))return null;throw error;}},
 write:async(path,data)=>{await Filesystem.writeFile({path:pathOf(path),data,directory:Directory.Data,encoding:Encoding.UTF8,recursive:true});},
 rename:async(from,to)=>{await Filesystem.rename({from:pathOf(from),to:pathOf(to),directory:Directory.Data,toDirectory:Directory.Data});},
 remove:async path=>{await Filesystem.deleteFile({path:pathOf(path),directory:Directory.Data});},
});
