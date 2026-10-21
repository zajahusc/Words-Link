import {randomBytes} from 'node:crypto';
import {readFile,writeFile,chmod} from 'node:fs/promises';
const file=new URL('../.env.local',import.meta.url);
let content;try{content=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;content=await readFile(new URL('../.env.example',import.meta.url),'utf8');}
if(!/^WORDS_LINK_ADMIN_TOKEN=.+$/m.test(content))content=content.replace(/^WORDS_LINK_ADMIN_TOKEN=.*$/m,`WORDS_LINK_ADMIN_TOKEN=${randomBytes(32).toString('hex')}`);
await writeFile(file,content,{mode:0o600});await chmod(file,0o600);
console.log('Prepared .env.local with a private admin token. Open that file in your editor to add the API key. No secret values were printed.');
