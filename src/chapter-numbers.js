const digits={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
export function chineseNumber(value){
 if(!value)return null;const s=value.normalize('NFKC');if(/^\d+$/.test(s))return Number(s);
 if(!/^[零〇一二两三四五六七八九十百千万]+$/.test(s))return null;
 if(!/[十百千万]/.test(s))return Number([...s].map(c=>digits[c]).join(''));
 let total=0,section=0,n=0;for(const c of s){if(c in digits)n=digits[c];else if(c==='万'){total+=(section+n||1)*10000;section=0;n=0;}else{section+=(n||1)*({'十':10,'百':100,'千':1000}[c]);n=0;}}return total+section+n;
}
export function headingNumber(text){const m=text.normalize('NFKC').match(/^(?:第\s*([零〇一二两三四五六七八九十百千万\d]+)\s*[章节回集幕话篇]|(?:chapter|episode|ep\.?)\s*(\d+)\b|([零〇一二两三四五六七八九十百千万\d]+)[、.．\s])/i);return m?chineseNumber(m[1]||m[2]||m[3]):null;}
