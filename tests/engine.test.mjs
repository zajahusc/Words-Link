import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dailyKey,points,createGraph,tiles,validPrefix,shareText} from '../engine.js';
const data=JSON.parse(await readFile(new URL('../data/Synonyms.json',import.meta.url)));
const schedule=JSON.parse(await readFile(new URL('../data/DailyChallenges.json',import.meta.url)));
const links=createGraph(data);
test('New York reset includes standard and daylight saving time',()=>{
 assert.equal(dailyKey(new Date('2026-10-21T03:59:59Z')),'2026-10-20');
 assert.equal(dailyKey(new Date('2026-10-21T04:00:00Z')),'2026-10-21');
 assert.equal(dailyKey(new Date('2026-12-21T04:59:59Z')),'2026-12-20');
 assert.equal(dailyKey(new Date('2026-12-21T05:00:00Z')),'2026-12-21');
});
test('scoring matches iOS with efficiency, hard and assisted rules',()=>{
 assert.equal(points(5,5,false,false),200);assert.equal(points(5,7,false,false),180);
 assert.equal(points(5,20,false,false),150);assert.equal(points(5,5,true,false),400);
 assert.equal(points(5,5,true,true),0);assert.equal(points(5,4,false,false),0);
});
test('all daily routes exist and their par is the shortest path',()=>{
 assert.equal(new Set(schedule.map(c=>c.date)).size,schedule.length);
 for(const {date,route} of schedule){
 assert.ok(route.length>=5&&route.length<=12,date);
 assert.deepEqual(validPrefix(route,route[0],links),route,date);
 const queue=[[route[0],0]],seen=new Set([route[0]]);let distance;
 for(let i=0;i<queue.length;i++){
 const [word,depth]=queue[i];if(word===route.at(-1)){distance=depth;break;}
 for(const next of links(word))if(!seen.has(next)){seen.add(next);queue.push([next,depth+1]);}
 }
 assert.equal(distance,route.length-1,date);
 }
});
test('tile samples preserve solution and are deterministic',async()=>{
 for(const {date,route}of schedule.slice(0,30))for(let i=0;i<route.length-1;i++){
 const choices=links(route[i]).filter(w=>!route.slice(0,i+1).includes(w));
 const selected=await tiles(choices,route[i],route.at(-1),route,date);
 assert.ok(selected.includes(route[i+1]));assert.ok(selected.length<=12);
 assert.deepEqual(selected,await tiles(choices,route[i],route.at(-1),route,date));
 }
});
test('saved invalid paths are truncated and shares contain no answer',()=>{
 const route=schedule[0].route;
 assert.deepEqual(validPrefix([route[0],route[1],'fake-word'],route[0],links),route.slice(0,2));
 const text=shareText({day:schedule[0].date,route,par:route.length-2,hard:false,assisted:false,points:200});
 for(const word of route)assert.ok(!text.includes(word));
});
