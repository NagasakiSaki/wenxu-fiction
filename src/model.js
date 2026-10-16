export const OWNER='NagasakiSaki', REPO='wenxu-fiction';
export function splitChapters(text){
 const lines=String(text).replace(/\r\n?/g,'\n').split('\n'); const chapters=[];let title='',body=[];
 const flush=()=>{if(body.join('\n').trim())chapters.push({title:title||'序言',body:body.join('\n').trim()});};
 for(const line of lines){const clean=line.trim().replace(/^#{1,6}\s+/, '');const chinese=/^第\s*[零〇一二三四五六七八九十百千万两\d０-９]+\s*[章节回卷部](?!的)/.test(clean)&&!/[。！？!?；;]$/.test(clean);const heading=chinese||/^chapter\s+[\divxlc]+\b/i.test(clean)||/^#{1,3}\s+\S/.test(line)||/^(序章|楔子|序言|尾声|后记|番外)(?:\s|[：:、]|$)/.test(clean);if(heading&&clean.length<100){flush();title=clean;body=[];}else body.push(line);}
 flush();return chapters.length?chapters:[{title:'第一章',body:String(text).trim()}];
}
export function validateBook(book){if(!book||typeof book!=='object')throw Error('作品格式无效');if(!/^[a-z0-9-]{3,80}$/.test(book.id||''))throw Error('作品编号需为 3–80 位小写字母、数字或短横线');for(const key of ['title','author','category','intro'])if(typeof book[key]!=='string')throw Error('作品资料不完整');if(!book.title.trim()||!book.author.trim()||book.title.length>100||book.author.length>60)throw Error('请填写有效书名和笔名');if(book.intro.length>1000||book.category.length>30)throw Error('简介或分类过长');if(!['连载中','已完结'].includes(book.status))throw Error('作品状态无效');if(!Array.isArray(book.chapters)||!book.chapters.length||book.chapters.length>1000)throw Error('作品需要 1–1000 个章节');let size=0;for(const c of book.chapters){if(typeof c.title!=='string'||!c.title.trim()||c.title.length>100||typeof c.body!=='string'||!c.body.trim())throw Error('每章都需要标题和正文');size+=c.body.length;}if(size>200000)throw Error('单部作品暂限 20 万字符');return book;}
export const countWords=book=>book.chapters.reduce((sum,c)=>sum+c.body.replace(/\s/g,'').length,0);
