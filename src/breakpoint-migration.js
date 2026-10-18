// Textarea coordinates are UTF-16. Never guess an anchor inside changed text.
const boundary=(text,offset)=>!( /[\uD800-\uDBFF]/.test(text[offset-1]||'') && /[\uDC00-\uDFFF]/.test(text[offset]||'') );

function inputRange(before,after,hint){
 if(!hint||!Number.isInteger(hint.start)||!Number.isInteger(hint.end))return null;
 let {start,end}=hint;
 if(start<0||end<start||end>before.length)return null;
 const type=hint.inputType||'';
 if(start===end&&type.startsWith('delete')){
  const removed=before.length-after.length;
  if(removed<0)return null;
  if(type.endsWith('Backward'))start-=removed;
  else if(type.endsWith('Forward'))end+=removed;
  else return null;
 }else if(!type.startsWith('insert')&&!type.startsWith('delete'))return null;
 const newEnd=after.length-(before.length-end);
 if(start<0||end>before.length||newEnd<start||!boundary(before,start)||!boundary(before,end)||!boundary(after,start)||!boundary(after,newEnd))return null;
 if(before.slice(0,start)!==after.slice(0,start)||before.slice(end)!==after.slice(newEnd))return null;
 return {start,end,newEnd,method:'input-range',ambiguous:false};
}

export function migrateBreakpoints(before,after,points,hint){
 const valid=[...new Set(points)].filter(p=>Number.isInteger(p)&&p>0&&p<before.length&&boundary(before,p)).sort((a,b)=>a-b).slice(0,999);
 if(before===after)return {points:valid,removed:points.length-valid.length,moved:0,method:'unchanged'};
 let range=inputRange(before,after,hint);
 if(!range){
  let start=0,suffix=0;
  while(start<Math.min(before.length,after.length)&&before[start]===after[start])start++;
  while(start>0&&(!boundary(before,start)||!boundary(after,start)))start--;
  while(suffix<Math.min(before.length,after.length)&&before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
  const ambiguous=start+suffix>Math.min(before.length,after.length);
  const earliest=ambiguous?Math.min(start,before.length-suffix,after.length-suffix):start;
  suffix=Math.min(suffix,before.length-start,after.length-start);
  while(suffix>0&&(!boundary(before,before.length-suffix)||!boundary(after,after.length-suffix)))suffix--;
  range={start:earliest,end:before.length-suffix,newEnd:after.length-suffix,method:ambiguous?'ambiguous-diff':'text-diff',ambiguous};
 }
 const {start,end,newEnd,ambiguous}=range,delta=newEnd-end,next=[];let moved=0;
 for(const point of valid){
  if(ambiguous&&point>=start&&point<=end)continue;
  if(point>start&&point<end)continue;
  // Insertions at a marker belong to the preceding chapter (right gravity).
  const mapped=point>=end?point+delta:point;
  if(mapped<=0||mapped>=after.length||!boundary(after,mapped)||next.includes(mapped))continue;
  next.push(mapped);if(mapped!==point)moved++;
 }
 return {points:next,removed:points.length-next.length,moved,method:range.method,change:{start,end,newEnd}};
}
