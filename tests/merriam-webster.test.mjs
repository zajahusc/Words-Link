import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEntries,lookup,plainText} from '../server/merriam-webster.js';
const sense=(synonyms,definition='a {it}shared{/it} meaning',extra={})=>({dt:[['text',definition]],syn_list:[synonyms.map(wd=>({wd}))],...extra});
const entry=(word,senses,extra={})=>({meta:{id:word,offensive:false},fl:'adjective',def:[{sseq:senses.map(s=>[['sense',s]])}],...extra});
test('extracts strict sense-specific synonyms and definitions without related words or antonyms',()=>{
 const payload=[entry('bright',[sense(['clear','smart'],undefined,{rel_list:[[{wd:'nearby'}]],ant_list:[[{wd:'dull'}]],sim_list:[[{wd:'almost'}]]})])];
 const result=parseEntries('bright',payload);
 assert.deepEqual(result.senses,[{partOfSpeech:'adjective',definition:'a shared meaning',synonyms:['clear','smart']}]);
 assert.ok(!JSON.stringify(result).includes('nearby'));
});
test('rejects spelling suggestions, unmatched heads, offensive entries and uncommon senses',()=>{
 const payload=['brighten',entry('brighter',[sense(['clear'])]),entry('bright',[sense(['clear'])],{meta:{id:'bright',offensive:true}}),entry('bright',[sense(['old'],undefined,{sls:['archaic']}),sense(['common'],undefined,{syn_list:[[{wd:'rare',wsls:['rare']},{wd:'common'},{wd:'two words'},{wd:'bright'}]]})])];
 assert.deepEqual(parseEntries('bright',payload).senses.map(s=>s.synonyms),[['common']]);
 assert.deepEqual(parseEntries('bright',['brightness']).senses,[]);
});
test('handles homographs, nested senses, binding substitutes and divided senses',()=>{
 const root=sense(['clear']);root.sdsense=sense(['smart']);
 const payload=[entry('bright:1',[],{def:[{sseq:[[['pseq',[['sense',root],['bs',{sense:sense(['quick'])}]]]]]}]})];
 assert.deepEqual(parseEntries('bright',payload).senses.flatMap(s=>s.synonyms).sort(),['clear','quick','smart']);
});
test('removes provider markup without interpreting HTML',()=>{
 assert.equal(plainText('{bc}a {a_link|happy} {sx|person||1}'),'a happy person');
});
test('key is sent only to the fixed upstream host; failures redact URLs, bodies and credentials',async()=>{
 const key='synthetic-secret-do-not-expose';
 const result=await lookup('bright',{key,fetchImpl:async url=>{
 assert.equal(url.origin,'https://www.dictionaryapi.com');assert.equal(url.searchParams.get('key'),key);
 return new Response(JSON.stringify([entry('bright',[sense(['clear'])])]),{status:200});
 }});
 assert.ok(!JSON.stringify(result).includes(key));
 for(const fetchImpl of [async()=>{throw Error('https://example.invalid?key='+key);},async()=>new Response(key,{status:401}),async()=>new Response(key,{status:200})]){
 await assert.rejects(lookup('bright',{key,fetchImpl}),error=>!error.message.includes(key)&&!error.message.includes('http'));
 }
 let called=false;await assert.rejects(lookup('../secret',{key,fetchImpl:async()=>{called=true;}}));assert.equal(called,false);
});
