/** Download only the reading copy, never draft metadata or source attachments. */
export function downloadableBook(book, chapterIndex=null){
 const result={};
 for(const key of ['title','author','intro','category','status','updated','demo'])if(book[key]!==undefined)result[key]=book[key];
 result.id=book.sourceId||book.id;
 let chapters=book.chapters;
 if(chapterIndex!==null){
  if(!Number.isInteger(chapterIndex)||!chapters[chapterIndex])throw Error('下载章节不存在');
  result.title=`${book.title} - ${chapters[chapterIndex].title}`.slice(0,100);
  result.id=`${result.id.slice(0,65)}-chapter-${chapterIndex+1}`;
  chapters=[chapters[chapterIndex]];
 }
 result.chapters=chapters.map(c=>({title:c.title,body:c.body,...(c.volume?{volume:c.volume}:{}),...(Array.isArray(c.sections)?{sections:c.sections.map(({title,paragraph})=>({title,paragraph}))}:{})}));
 return result;
}
