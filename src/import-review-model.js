import {MAX_BOOK_CHARACTERS} from './limits.js';
export const ENGINE_VERSION='2.0.0';
export function replaceSourceAnalysis(result,index,analysis){
 if(!result.sources[index])throw Error('文档已不存在');if(!analysis.chapters.length)throw Error('校正结果没有可阅读正文，请保留至少一个正文段落');
 const sources=result.sources.map((source,i)=>i===index?{...source,analysis,method:analysis.method,frontMatter:analysis.frontMatter,subtitle:analysis.subtitle}: {...source});
 const chapters=[];let total=0;for(const source of sources){source.start=chapters.length;source.count=source.analysis.chapters.length;chapters.push(...source.analysis.chapters);total+=source.analysis.chapters.reduce((n,c)=>n+c.body.length,0);}
 if(chapters.length>1000||total>MAX_BOOK_CHARACTERS)throw Error('校正结果超过1000章或200万字符，请减少文档后重试');
 return {...result,sources,chapters,total};
}
// Reports omit manuscript bodies, file paths, book names and heading titles.
// They are reproducible structural evidence, not a new public manuscript export.
export function importReport(result){return {format:'wenxu-structure-report-v1',engineVersion:ENGINE_VERSION,generatedAt:new Date().toISOString(),documents:result.sources.map((source,index)=>({document:index+1,method:source.method,metrics:source.analysis.metrics,boundaryLines:source.analysis.boundaryLines,candidates:source.analysis.candidates.map(({line,kind,selected,confidence,evidence})=>({line,kind,selected,confidence,evidence})),diagnostics:source.analysis.diagnostics.map(({code,line})=>({code,line})),chapters:source.analysis.chapters.map(c=>({startLine:c.sourceStartLine,endLine:c.sourceEndLine,characters:c.body.length}))})),failed:result.failed.length,skipped:result.skipped.length};}
