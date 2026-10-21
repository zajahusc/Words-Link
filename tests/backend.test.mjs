import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphFromEntries,makeSchedule,validateSchedule} from '../server/puzzles.js';
import {createAPI} from '../server/api.js';
import {prepareDictionary} from '../server/prepare.js';
import {createGraph} from '../engine.js';
function memoryStore(){
 const records=new Map();let count=0;
 return {
 async get(key){return records.get(key)?.data??null;},
 async getWithMetadata(key){return records.get(key)??null;},
 async setJSON(key,data,opts={}){
 const old=records.get(key);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch)return {modified:false};
 const etag=String(++count);records.set(key,{data:structuredClone(data),etag});return {modified:true,etag};
 },async delete(key){records.delete(key);}
 };
}
const vocabulary=['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india'];
const entries=vocabulary.slice(0,-1).map((word,i)=>({word,senses:[{partOfSpeech:'noun',definition:'Synthetic test meaning',synonyms:[vocabulary[i+1]]}]}));
const database=graphFromEntries(entries,'test-v1');
const schedule=makeSchedule(database,{startDay:'2026-10-21',days:3});
const dataset={provider:'merriam-webster',version:'test-v1',database,schedule};
const env={MERRIAM_WEBSTER_API_KEY:'synthetic-key',WORDS_LINK_ADMIN_TOKEN:'synthetic-admin-token-with-32-characters',MW_LICENSE_APPROVED:'true',MW_DATASET_VERSION:'test-v1',MW_ACTIVATE_ON:'2026-10-21'};
test('frozen graph supports both synonym directions and verified 3–10 par puzzles',()=>{
 const links=createGraph(database);assert.ok(links('alpha').includes('bravo'));assert.ok(links('bravo').includes('alpha'));
 validateSchedule(database,schedule);
 assert.equal(schedule.length,3);assert.equal(schedule[2].date,'2026-10-23');
 const invalid=structuredClone(schedule);invalid[0].route=['alpha','bravo','charlie','delta','echo','delta','foxtrot'];
 assert.throws(()=>validateSchedule(database,invalid));
});
test('backend changes providers at New York midnight and never returns secrets',async()=>{
 const store=memoryStore();await store.setJSON('datasets/test-v1',dataset);
 const request=new Request('https://example.test/api/dictionary');
 const before=await createAPI({store,env,now:()=>new Date('2026-10-21T03:59:59Z')})(request);
 assert.equal((await before.json()).provider,'wordnet');
 const after=await createAPI({store,env,now:()=>new Date('2026-10-21T04:00:00Z')})(request);
 const body=await after.text();assert.equal(JSON.parse(body).provider,'merriam-webster');assert.ok(!body.includes(env.MERRIAM_WEBSTER_API_KEY));assert.ok(!body.includes(env.WORDS_LINK_ADMIN_TOKEN));
});
test('missing/unapproved activated dictionary fails explicitly, without a WordNet fallback',async()=>{
 for(const modified of [env,{...env,MW_LICENSE_APPROVED:'false'}]){
 const response=await createAPI({store:memoryStore(),env:modified,now:()=>new Date('2026-10-21T12:00:00Z')})(new Request('https://example.test/api/dictionary'));
 assert.equal(response.status,503);
 }
});
test('admin status requires a separate token and never returns either secret',async()=>{
 const api=createAPI({store:memoryStore(),env});
 for(const authorization of ['', 'Bearer synthetic-key','Bearer bad-token']){
 const response=await api(new Request('https://example.test/api/admin/status',{headers:{Authorization:authorization}}));assert.equal(response.status,401);
 }
 const response=await api(new Request('https://example.test/api/admin/status',{headers:{Authorization:`Bearer ${env.WORDS_LINK_ADMIN_TOKEN}`}}));
 const text=await response.text();assert.equal(response.status,200);assert.ok(!text.includes(env.MERRIAM_WEBSTER_API_KEY));assert.ok(!text.includes(env.WORDS_LINK_ADMIN_TOKEN));
});
test('preparation is approval-gated and bounded, produces immutable data and reuses it',async()=>{
 const store=memoryStore(),options={version:'test-v1',startDay:'2026-10-21',maxQueries:8,days:3};
 let calls=0;const lookupImpl=async word=>{calls++;return entries.find(e=>e.word===word)||{word,senses:[]};};
 await assert.rejects(prepareDictionary({store,env:{...env,MW_LICENSE_APPROVED:'false'},options,lookupImpl}),{code:'APPROVAL_REQUIRED'});assert.equal(calls,0);
 const result=await prepareDictionary({store,env,options,lookupImpl,seeds:['alpha'],pause:async()=>{}});
 assert.equal(result.state,'ready');assert.equal(result.puzzles,3);assert.equal(calls,8);
 const stored=await store.get('datasets/test-v1');validateSchedule(stored.database,stored.schedule);assert.ok(!JSON.stringify(stored).includes(env.MERRIAM_WEBSTER_API_KEY));
 await prepareDictionary({store,env,options,lookupImpl,seeds:['alpha']});assert.equal(calls,8);
});
test('concurrent preparation cannot spend the API budget twice',async()=>{
 const store=memoryStore();await store.setJSON('generation-lock',{runId:'other',expires:Date.now()+60000});let calls=0;
 await assert.rejects(prepareDictionary({store,env,options:{version:'test-v1',startDay:'2026-10-21',days:1,maxQueries:8},lookupImpl:async()=>{calls++;}}),{code:'BUILD_RUNNING'});assert.equal(calls,0);
});
test('daily request budget is durable and counted before upstream access',async()=>{
 const store=memoryStore();await store.setJSON('usage/2026-10-20',{queries:800});let calls=0;
 await assert.rejects(prepareDictionary({store,env,options:{version:'test-v1',startDay:'2026-10-21',days:1,maxQueries:8},now:()=>Date.parse('2026-10-20T12:00:00Z'),lookupImpl:async()=>{calls++;}}),{code:'DAILY_BUDGET'});assert.equal(calls,0);
 assert.equal((await store.get('status/test-v1')).code,'DAILY_BUDGET');
});
test('saved attempts can retrieve an older immutable version while another version is active',async()=>{
 const store=memoryStore();await store.setJSON('datasets/test-v1',dataset);
 const api=createAPI({store,env:{...env,MW_DATASET_VERSION:'test-v2'},now:()=>new Date('2026-10-21T12:00:00Z')});
 assert.equal((await api(new Request('https://example.test/api/dictionary'))).status,503);
 const response=await api(new Request('https://example.test/api/dictionary?version=test-v1'));
 assert.equal(response.status,200);assert.equal((await response.json()).version,'test-v1');
});
