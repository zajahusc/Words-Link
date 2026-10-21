import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDictionary,meaningLookup} from '../dictionary-client.js';
const legacy={words:['old'],neighbors:[[]],version:'OEWN-2025'};
const info={provider:'merriam-webster',version:'mw-v1',database:{version:'mw-v1',words:['new'],neighbors:[[]]},schedule:[]};
const fetcher=(response,requests=[])=>async path=>{requests.push(path);if(path==='api/dictionary')return response();return new Response(JSON.stringify(path.endsWith('Synonyms.json')?legacy:[]));};
test('static hosting loads the legacy dictionary, new hosting loads the licensed snapshot',async()=>{
 assert.equal((await loadDictionary({fetchImpl:fetcher(()=>new Response('',{status:404}))})).version,'OEWN-2025');
 assert.equal((await loadDictionary({fetchImpl:fetcher(()=>new Response(JSON.stringify(info)))})).version,'mw-v1');
});
test('unfinished legacy attempts and completed results keep their dictionary on switch day',async()=>{
 for(const active of [{savedSession:{day:'2026-10-21',path:['old']}},{finish:{day:'2026-10-21',route:['old']}}]){
 const data=await loadDictionary({fetchImpl:fetcher(()=>new Response(JSON.stringify(info))),day:'2026-10-21',...active});assert.equal(data.version,'OEWN-2025');
 }
 const data=await loadDictionary({fetchImpl:fetcher(()=>new Response(JSON.stringify(info))),day:'2026-10-22',savedSession:{day:'2026-10-21',path:['old']}});assert.equal(data.version,'mw-v1');
});
test('a configured but unavailable backend never silently changes dictionary',async()=>{
 const requests=[];await assert.rejects(loadDictionary({fetchImpl:fetcher(()=>new Response('{}',{status:503}),requests)}));assert.deepEqual(requests,['api/dictionary']);
 await assert.rejects(loadDictionary({day:'2026-10-21',fetchImpl:fetcher(()=>new Response(JSON.stringify({provider:'wordnet',activateOn:'2026-10-21'})))}));
});
test('shared meaning explanations work in both directions',()=>{
 const sense={headword:'bright',partOfSpeech:'adjective',definition:'Synthetic definition',synonyms:['clear']};
 const explain=meaningLookup({meanings:[sense]});assert.deepEqual(explain('bright','clear'),[sense]);assert.deepEqual(explain('clear','bright'),[sense]);assert.deepEqual(explain('bright','dark'),[]);
});
test('an in-progress Merriam-Webster puzzle pins its original dictionary version',async()=>{
 const requests=[];
 const data=await loadDictionary({day:'2026-10-21',savedSession:{day:'2026-10-21',dictionaryVersion:'mw-v0'},fetchImpl:async path=>{
 requests.push(path);return new Response(JSON.stringify(path.includes('?version=')?{...info,version:'mw-v0',database:{...info.database,version:'mw-v0'}}:info));
 }});
 assert.equal(data.version,'mw-v0');assert.deepEqual(requests,['api/dictionary','api/dictionary?version=mw-v0']);
});
