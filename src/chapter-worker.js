import {analyseChapters} from './chapter-analysis.js';
self.onmessage=({data})=>{try{self.postMessage({result:analyseChapters(data.text,data.options)});}catch(error){self.postMessage({error:error.message});}};
