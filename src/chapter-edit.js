import {chineseNumber} from './chapter-numbers.js';
import {MAX_BOOK_CHARACTERS} from './limits.js';
const numeral='零〇一二两三四五六七八九十百千万\\d０-９';
function chinese(n){if(n===0)return '零';const units=['','十','百','千'];if(n>=10000)return String(n);let result='',zero=false;for(let i=3;i>=0;i--){const digit=Math.floor(n/10**i)%10;if(digit){if(zero&&result)result+='零';result+='零一二三四五六七八九'[digit]+units[i];zero=false;}else if(result)zero=true;}return result.replace(/^一十/,'十');}
export function numberedTitle(title){
 const cn=title.match(new RegExp(`^(第\\s*)([${numeral}]+)(\\s*)([章节回集幕话篇])`));
 const en=!cn&&title.match(/^((?:chapter|episode|ep\.?)\s+)(\d+)/i);const m=cn||en;if(!m)return null;
 const raw=m[2],number=chineseNumber(raw);if(!Number.isInteger(number))return null;
 return {number,family:cn?'cn:'+m[4]:'en:'+m[1].trim().toLowerCase().replace('.',''),format:n=>{let value=/[零〇一二两三四五六七八九十百千万]/.test(raw)?chinese(n):String(n).padStart(raw.length,'0');if(/[０-９]/.test(raw))value=value.replace(/\d/g,d=>String.fromCharCode(d.charCodeAt(0)+0xfee0));return m[1]+value+(cn?m[3]+m[4]:'');},suffix:title.slice(m[0].length)};
}
function cleanSource(chapter,changes){const {sourceStartLine,sourceEndLine,...rest}=chapter;return {...rest,...changes};}
function checked(chapters){if(chapters.length>1000)throw Error('作品最多1000章，请先合并或减少章节');if(chapters.some(c=>c.title.length>100))throw Error('顺延后有章节标题超过100字，请取消顺延或缩短章名');if(chapters.reduce((n,c)=>n+c.body.length,0)>MAX_BOOK_CHARACTERS)throw Error('调整后超过200万字符上限');return chapters;}
function shiftFollowing(chapters,start,basis,delta){let stop=false;return chapters.map((chapter,index)=>{if(index<start||stop)return chapter;if(/^第\s*[零〇一二两三四五六七八九十百千万\d０-９]+\s*[卷部]/.test(chapter.title)){stop=true;return chapter;}const number=numberedTitle(chapter.title);if(!number||number.family!==basis.family)return chapter;if(number.number<=basis.number){stop=true;return chapter;}return {...chapter,title:number.format(number.number+delta)+number.suffix};});}
export function splitChapter(chapters,index,offset,{title,renumber=true}={}){
 const current=chapters[index];if(!current)throw Error('请先选择章节');if(!Number.isInteger(offset)||offset<=0||offset>=current.body.length)throw Error('请把光标放在正文中间的分章位置');
 // JS textarea offsets use UTF-16. Reject a point inside a surrogate pair.
 if(/[\uD800-\uDBFF]/.test(current.body[offset-1])&&/[\uDC00-\uDFFF]/.test(current.body[offset]))throw Error('断点不能位于一个字符内部，请移动光标');
 const before=current.body.slice(0,offset),after=current.body.slice(offset);if(!before.trim()||!after.trim())throw Error('断点前后都需要有正文，不能拆出空章');
 const basis=numberedTitle(current.title)||numberedTitle(`第 ${index+1} 章`),newTitle=title?.trim()||basis.format(basis.number+1);if(newTitle.length>100)throw Error('章节标题最多100字');
 let next=[...chapters.slice(0,index),cleanSource(current,{body:before}),{title:newTitle,body:after},...chapters.slice(index+1)];
 if(renumber)next=shiftFollowing(next,index+2,basis,1);return checked(next);
}
export function splitChapterAtPoints(chapters,index,offsets,{renumber=true}={}){
 const current=chapters[index];if(!current)throw Error('请先选择章节');if(!Array.isArray(offsets)||!offsets.length)throw Error('请至少保留一个断点');
 const points=[...new Set(offsets)].sort((a,b)=>a-b);if(chapters.length+points.length>1000)throw Error('拆分后超过1000章，请减少断点或增大目标字数');
 for(const point of points){if(!Number.isInteger(point)||point<=0||point>=current.body.length)throw Error('断点必须位于正文内部');if(/[\uD800-\uDBFF]/.test(current.body[point-1])&&/[\uDC00-\uDFFF]/.test(current.body[point]))throw Error('断点不能位于一个字符内部');}
 const boundaries=[0,...points,current.body.length],basis=numberedTitle(current.title)||numberedTitle(`第 ${index+1} 章`),parts=boundaries.slice(0,-1).map((start,i)=>{const body=current.body.slice(start,boundaries[i+1]);if(!body.trim())throw Error('两个断点之间没有正文，请取消多余断点');return i?{title:basis.format(basis.number+i),body}:cleanSource(current,{body});});
 let result=[...chapters.slice(0,index),...parts,...chapters.slice(index+1)];if(renumber)result=shiftFollowing(result,index+parts.length,basis,points.length);return checked(result);
}
export function mergeNextChapter(chapters,index,{renumber=true}={}){
 const current=chapters[index],following=chapters[index+1];if(!current||!following)throw Error('当前章后没有可合并的章节');
 const basis=numberedTitle(following.title)||numberedTitle(`第 ${index+2} 章`),next=[...chapters.slice(0,index),cleanSource(current,{body:current.body+'\n\n'+following.body}),...chapters.slice(index+2)];
 return checked(renumber?shiftFollowing(next,index+1,basis,-1):next);
}
export function changedTitles(before,after,kind,index){return after.flatMap((chapter,i)=>{if(i<=index||kind==='split'&&i===index+1)return [];const old=before[kind==='split'?i-1:i+1];return old&&old.title!==chapter.title?[{before:old.title,after:chapter.title}]:[];});}
