// Rebuild paragraph anchors after edits; original source line numbers no longer apply.
export function refreshSections(chapter){
 if(!Array.isArray(chapter.sections))return chapter;
 const sections=[];let paragraph=0,seen=false,gap=false,fence=null;
 for(const line of chapter.body.replace(/\r\n?/g,'\n').split('\n')){
  const marker=line.trim().match(/^(`{3,}|~{3,})/);if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;}
  if(!line.trim()){if(seen&&!gap)paragraph++;gap=true;continue;}seen=true;gap=false;if(marker||fence)continue;
  const title=line.trim().replace(/^#{1,6}\s+/,'').replace(/^(\*\*|__)(.*)\1$/,'$2').replace(/^[【「\[](.+)[】」\]]$/,'$1').trim();
  const cn=title.normalize('NFKC').match(/^第\s*[零〇一二三四五六七八九十百千万两\d]+\s*节(.*)$/);
  if(title.length<=100&&(cn&&!/^(的|完|结束|终了)/.test(cn[1].trim())&&!/[。；;]$/.test(title)||/^section\s*\d+\b/i.test(title)))sections.push({title,paragraph});
 }
 return {...chapter,sections};
}
export function chapterPart(current,title,body){return refreshSections({title,body,...(current.volume?{volume:current.volume}:{}),...(Array.isArray(current.sections)?{sections:[]}: {})});}
