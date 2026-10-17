export function chapterLinks(book,esc,{grid=false,activeIndex=-1}={}){
 let previous='';return book.chapters.map((c,i)=>{const volume=typeof c.volume==='string'?c.volume:'';const heading=volume&&volume!==previous?`<div class="toc-volume">${esc(volume)}</div>`:'';previous=volume;
 const sections=Array.isArray(c.sections)?c.sections.slice(0,100).filter(s=>s&&typeof s.title==='string'):[];
 return heading+`<a class="${i===activeIndex?'active':''}" href="#/read/${book.id}/${i}/start" data-toc-chapter="${i}">${grid?`<span>${String(i+1).padStart(2,'0')}</span>`:''}${esc(c.title)}${grid?'<b>→</b>':''}</a>`+sections.map(s=>`<a class="toc-section" href="#/read/${book.id}/${i}/at/${Number.isInteger(s.paragraph)&&s.paragraph>=0?s.paragraph:0}/0">${esc(s.title)}</a>`).join('');}).join('');
}
