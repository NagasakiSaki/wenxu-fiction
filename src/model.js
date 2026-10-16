import {MAX_BOOK_CHARACTERS} from './limits.js';
import {analyseChapters} from './chapter-analysis.js';
export const OWNER='NagasakiSaki', REPO='wenxu-fiction';
export {analyseChapters} from './chapter-analysis.js';
export function splitChapters(text,options){return analyseChapters(text,options).chapters;}
export function validateBook(book){if(!book||typeof book!=='object')throw Error('作品格式无效');if(!/^[a-z0-9-]{3,80}$/.test(book.id||''))throw Error('作品编号需为 3–80 位小写字母、数字或短横线');for(const key of ['title','author','category','intro'])if(typeof book[key]!=='string')throw Error('作品资料不完整');if(!book.title.trim()||!book.author.trim()||book.title.length>100||book.author.length>60)throw Error('请填写有效书名和笔名');if(book.intro.length>1000||book.category.length>30)throw Error('简介或分类过长');if(!['连载中','已完结'].includes(book.status))throw Error('作品状态无效');if(!Array.isArray(book.chapters)||!book.chapters.length||book.chapters.length>1000)throw Error('作品需要 1–1000 个章节');let size=0;for(const c of book.chapters){if(typeof c.title!=='string'||!c.title.trim()||c.title.length>100||typeof c.body!=='string'||!c.body.trim())throw Error('每章都需要标题和正文');size+=c.body.length;}if(size>MAX_BOOK_CHARACTERS)throw Error('单部作品暂限 200 万字符');return book;}
export const countWords=book=>book.chapters.reduce((sum,c)=>sum+c.body.replace(/\s/g,'').length,0);
