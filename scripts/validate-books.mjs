import {readdirSync,readFileSync} from 'node:fs';
import {validateBook} from '../src/model.js';
const ids=new Set();for(const name of readdirSync('content/books').filter(n=>n.endsWith('.json'))){const book=validateBook(JSON.parse(readFileSync('content/books/'+name,'utf8')));if(ids.has(book.id))throw Error('Duplicate book ID: '+book.id);ids.add(book.id);if(name!==book.id+'.json')throw Error('Filename must match book ID: '+name);}console.log('Validated '+ids.size+' books');
