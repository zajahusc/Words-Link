import {createHash} from 'node:crypto';
import {createGraph,validPrefix} from '../engine.js';
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function validDay(day){return typeof day==='string'&&datePattern.test(day)&&!Number.isNaN(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().startsWith(day);}
export function shiftDay(day,offset){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export function graphFromEntries(entries,version){
 const meanings=[];const edges=new Map();
 const add=word=>{if(!edges.has(word))edges.set(word,new Set());};
 for(const entry of entries)for(const sense of entry.senses){
  add(entry.word);
  const synonyms=sense.synonyms.filter(w=>w!==entry.word);
  if(!synonyms.length)continue;
  meanings.push({headword:entry.word,...sense,synonyms});
  for(const word of synonyms){add(word);edges.get(entry.word).add(word);edges.get(word).add(entry.word);}
 }
 const words=[...edges.keys()].sort(),indices=new Map(words.map((w,i)=>[w,i]));
 return {version,provider:'merriam-webster',words,neighbors:words.map(w=>[...edges.get(w)].sort().map(v=>indices.get(v))),meanings};
}
export function shortestRoutes(database,start,maxEdges=11){
 const links=createGraph(database),queue=[start],paths=new Map([[start,[start]]]);
 for(let i=0;i<queue.length;i++){
  const path=paths.get(queue[i]);if(path.length-1>=maxEdges)continue;
  for(const word of links(queue[i]))if(!paths.has(word)){paths.set(word,[...path,word]);queue.push(word);}
 }
 return paths;
}
export function makeSchedule(database,{startDay,days=365}={}){
 if(!validDay(startDay)||!Number.isInteger(days)||days<1||days>366)throw Error('Invalid schedule dates.');
 const candidates=[];
 // Ordered, deterministic search; no answer depends on API response order or randomness.
 const starts=database.words.map(word=>({word,rank:rank([word])})).sort((a,b)=>a.rank.localeCompare(b.rank));
 for(const {word:start} of starts){
  const eligible=[...shortestRoutes(database,start).values()].filter(route=>route.length>=5&&route.length<=12&&start<route.at(-1));
  eligible.sort((a,b)=>rank(a).localeCompare(rank(b)));
  // Spread starts across the vocabulary instead of filling the year from one headword.
  candidates.push(...eligible.slice(0,12));
  if(candidates.length>=days*20)break;
 }
 if(candidates.length<days)throw Error('Not enough distinct puzzles with par 3–10. Increase the query budget or expand the seed vocabulary.');
 candidates.sort((a,b)=>rank(a).localeCompare(rank(b)));
 const schedule=candidates.slice(0,days).map((route,i)=>({date:shiftDay(startDay,i),route}));
 validateSchedule(database,schedule);
 return schedule;
}
function rank(route){return createHash('sha256').update(route[0]+'|'+route.at(-1)).digest('hex');}
export function validateSchedule(database,schedule){
 const links=createGraph(database),cache=new Map(),seen=new Set();
 for(const {date,route}of schedule){
  if(!validDay(date)||seen.has(date)||!Array.isArray(route)||route.length<5||route.length>12||JSON.stringify(validPrefix(route,route[0],links))!==JSON.stringify(route))throw Error('Invalid daily route.');
  seen.add(date);
  if(!cache.has(route[0]))cache.set(route[0],shortestRoutes(database,route[0]));
  if(cache.get(route[0]).get(route.at(-1))?.length!==route.length)throw Error('Daily par is not the shortest route.');
 }
}
