import {analyseChapters} from './chapter-analysis.js';
export async function runChapterAnalysis(text,options={}){
 if(typeof Worker==='undefined'){await new Promise(resolve=>setTimeout(resolve,0));return analyseChapters(text,options);}
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./chapter-worker.js',import.meta.url),{type:'module'});
  const finish=(error,result)=>{clearTimeout(timer);worker.terminate();error?reject(Error(error)):resolve(result);};
  const timer=setTimeout(()=>finish('结构分析超过30秒，请拆分文档后重试；原草稿没有更改。'),30000);
  worker.onmessage=({data})=>finish(data.error,data.result);worker.onerror=()=>finish('结构分析未能完成，请重新导入或拆分文档；原草稿没有更改。');
  worker.postMessage({text,options});
 });
}
