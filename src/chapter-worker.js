import {analyseVisualPlan} from './visual-source-model.js';
import {analyseImportedChapters as analyseChapters} from './import-analysis.js';
self.onmessage=({data})=>{try{self.postMessage({result:data.options?.visualPlan?analyseVisualPlan(data.text,data.options):analyseChapters(data.text,data.options)});}catch(error){self.postMessage({error:error.message});}};
