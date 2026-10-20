import {dailyKey, points, createGraph, tiles, validPrefix, shareText} from './engine.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
let history = read('words-link.history.v1', []); if (!Array.isArray(history)) history=[];
let session, links, schedule, challenge, day, generation = 0;
let storageWarning = false;
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{if(!storageWarning){notice('Browser storage is unavailable. Progress will last for this visit.');storageWarning=true;}}}
function save(){write('words-link.session.v1',session);}
function notice(message){$('notice').textContent=message;$('notice').style.display='block';clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').style.display='none',4500);}
function modal(content){$('modal-content').innerHTML=content;if(!$('modal').open)$('modal').showModal();}
$('close-modal').onclick=()=>$('modal').close();
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
const current = () => session.path.at(-1);
const won = () => current() === challenge.route.at(-1);
const locked = () => session.path.length>1 || session.undos>0 || session.assisted || won();
function completed(){return history.find(f=>f.day===day);}
function checkDay(){if(day!==dailyKey()){startDay();notice('A fresh daily challenge is ready.');return false;}return true;}
function startDay(){
 day=dailyKey();challenge=schedule.find(c=>c.date===day);$('day').textContent=`Daily challenge · ${day}`;
 if(!challenge){$('game').innerHTML='<h2>More word play is on its way.</h2><p>No challenge is scheduled for today. Please check back after the puzzle schedule is updated.</p>';$('game').setAttribute('aria-busy','false');return;}
 const saved=read('words-link.session.v1',null);
 session=saved?.day===day ? {...saved,path:validPrefix(saved.path,challenge.route[0],links)} : {day,path:[challenge.route[0]],hard:false,assisted:false,undos:0,misses:0};
 const finish=completed();if(finish)session={...session,path:finish.route,hard:finish.hard,assisted:finish.assisted};
 save();render();
}
async function render(){
 const token=++generation;
 const total=history.reduce((sum,f)=>sum+f.points,0);
 $('total').textContent=`♜ ${total.toLocaleString()} points`;$('bridges').textContent=`${history.length} bridges · View stats ↗`;
 $('mode-label').textContent=session.hard?'HARD MODE':'NORMAL MODE';
 const target=challenge.route.at(-1), count=Math.max(0,session.path.length-(won()?2:1));
 const choices=links(current()).filter(w=>!session.path.includes(w));
 $('game').setAttribute('aria-busy','true');
 const visible=session.hard||won()?[]:tiles(choices);
 if(token!==generation)return;
 $('game').innerHTML=`<section class="endpoints" aria-label="Today's word bridge"><div class="endpoint"><small>START</small><strong>${escape(challenge.route[0])}</strong></div><span class="arrow" aria-hidden="true">→</span><div class="endpoint goal"><small>GOAL</small><strong>${escape(target)}</strong></div></section><section class="route"><span class="route-label">⌁ &nbsp; YOUR ROUTE</span><div class="trail">${session.path.map(escape).join('<i aria-hidden="true">→</i>')}</div><div class="route-meta">${count} bridge ${count===1?'word':'words'} · Par ${challenge.route.length-2}${session.assisted?' · Assisted':''}</div></section><div class="actions"><button id="undo" ${session.path.length<2||won()?'disabled':''}>↶ Undo</button><button id="restart" ${won()?'disabled':''}>Restart</button></div>${won()?'<h2>Nicely linked!</h2><p>Today’s bridge is in the books. Come back tomorrow for a fresh connection.</p><button id="results" class="primary">View results ↗</button>':session.hard?`<h3>What’s a synonym for “${escape(current())}”?</h3><p class="subtle">No clues. Follow your own train of thought.</p><form id="answer-form"><input id="answer" aria-label="Your next synonym" placeholder="Your next word" autocomplete="off" autocapitalize="none" spellcheck="false" required><button class="primary">Link word →</button><p id="feedback" class="feedback" role="status"></p></form>`:`<h3>Tap a synonym for “${escape(current())}”</h3><p class="subtle">Every synonym is available. Find your own way to the goal.<br>Hold a tile or right-click for a dictionary lookup.</p>${visible.length>12?'<input id="word-filter" type="search" aria-label="Filter synonyms" placeholder="Find a synonym…" autocomplete="off">':''}<div class="tiles">${visible.map(w=>`<button class="tile" data-word="${escape(w)}">${escape(w)}</button>`).join('')}</div>${!visible.length?'<p>A dead end! Undo and try a different word.</p>':''}`}${session.assisted||won()?`<div class="reveal-area"><h3>One way across</h3><p class="solution">${challenge.route.map(escape).join(' → ')}</p></div>`:!session.hard?'<div class="reveal-area"><button id="reveal" class="danger">△ &nbsp; Reveal route…</button></div>':''}`;
 $('game').setAttribute('aria-busy','false');
 $('word-filter')?.addEventListener('input',e=>{
  const query=e.target.value.trim().toLowerCase();
  document.querySelectorAll('.tile').forEach(button=>{button.hidden=!button.dataset.word.includes(query);});
 });
 $('undo').onclick=()=>{if(!checkDay()||won()||session.path.length<2)return;session.undos++;session.path.pop();save();render();};
 $('restart').onclick=()=>{if(!checkDay()||won())return;session.undos++;session.path=[challenge.route[0]];save();render();};
 $('results')?.addEventListener('click',results);
 $('reveal')?.addEventListener('click',()=>{modal('<h2>Are you sure?</h2><p>Revealing the route earns zero points for today, even after restarting. This cannot be undone.</p><button id="keep" class="primary">Keep playing</button> <button id="confirm-reveal" class="danger">Reveal route · 0 points</button>');$('keep').onclick=()=>$('modal').close();$('confirm-reveal').onclick=()=>{if(!checkDay())return;$('modal').close();session.assisted=true;save();render();};});
 $('answer-form')?.addEventListener('submit',e=>{e.preventDefault();if(!checkDay())return;const word=$('answer').value.trim().toLowerCase().replace(/\s+/g,' ');if(session.path.includes(word)||!choices.includes(word)){session.misses++;save();$('feedback').textContent=session.path.includes(word)?'That word is already in your bridge.':'That isn’t one of the puzzle’s synonyms. Try another word.';}else choose(word);});
 document.querySelectorAll('.tile').forEach(button=>{
 let timer,held=false;
 const define=()=>{held=true;modal(`<h2>${escape(button.dataset.word)}</h2><p>Dictionary definitions open in a new tab and require internet access.</p><a target="_blank" rel="noopener noreferrer" href="https://en.wiktionary.org/wiki/${encodeURIComponent(button.dataset.word)}#English">Look up this word ↗</a>`);};
 button.onclick=()=>{if(!held)choose(button.dataset.word);held=false;};
 button.oncontextmenu=e=>{e.preventDefault();define();};
 button.onpointerdown=()=>{held=false;timer=setTimeout(define,500);};
 for(const event of ['pointerup','pointerleave','pointercancel'])button.addEventListener(event,()=>clearTimeout(timer));
 });
}
function choose(word){
 if(!checkDay()||won()||completed()||session.path.includes(word)||!links(current()).includes(word))return;
 session.path.push(word);
 if(won()){
 const par=challenge.route.length-2;
 const finish={day,route:[...session.path],par,hard:session.hard,assisted:session.assisted,undos:session.undos,misses:session.misses,points:points(par,session.path.length-2,session.hard,session.assisted)};
 history.push(finish);write('words-link.history.v1',history);save();render();results();
 }else{save();render();}
}
async function share(finish){try{const text=shareText(finish);if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);notice('Spoiler-free results copied!');}}catch(error){if(error.name!=='AbortError'){modal(`<h2>Share your link</h2><p>Select and copy your results:</p><textarea readonly rows="9" style="width:100%">${escape(shareText(finish))}</textarea>`);}}}
function results(){const f=completed();if(!f)return;modal(`<div class="result"><p style="font-size:38px">✦</p><h2>Nicely linked!</h2><p>${f.day} · ${f.hard?'Hard':'Normal'}</p><p>${f.route.length-2} bridge words · Par ${f.par}</p><p class="points">${f.points} points</p>${f.assisted?'<p>Assisted solve · no points</p>':''}<button id="share" class="primary">Share results ↗</button><p class="subtle">Spoiler-free. Challenge a friend!</p><button id="see-route">See my route</button><p class="subtle">A fresh challenge arrives at midnight New York time.</p></div>`);$('share').onclick=()=>share(f);$('see-route').onclick=()=>$('modal').close();}
function help(){modal('<h2>Make a little connection.</h2><p>Start with one word. Reach the other by linking synonyms, one word at a time. A word’s different meanings can open up a new direction. Every valid synonym route counts; you do not have to follow the revealed example. Each puzzle’s shortest route (par) has 3–10 bridge words. Longer routes are allowed.</p><ol><li>In <strong>Normal</strong>, tap a synonym tile. Hold it for a dictionary lookup.</li><li>In <strong>Hard</strong>, type your own synonyms. No tiles or reveals.</li><li>Use Undo or Restart when you need a fresh direction.</li><li>Use fewer bridge words to earn more points.</li></ol><p>Everyone gets the same daily challenge. Your first finish is your result. Choose your mode before your first move.</p><h3>Every word counts</h3><p>100 points for finishing + 10 for each bridge word in the shortest route. Up to 50 efficiency points, minus 10 for each extra word. Hard doubles your points. A revealed route earns zero.</p>');}
$('help').onclick=help;
$('settings').onclick=()=>{modal(`<h2>A little your way.</h2><h3>Difficulty</h3><div class="mode-picker"><button id="normal-mode" class="${!session?.hard?'selected':''}" ${!session||locked()?'disabled':''}>Normal</button><button id="hard-mode" class="${session?.hard?'selected':''}" ${!session||locked()?'disabled':''}>Hard · 2× points</button></div><p>Normal: pick from the tiles.<br>Hard: type your own synonyms.</p><p class="subtle">${session&&locked()?'Your mode is locked for today.':'Choose before your first move. Both modes share today’s puzzle.'}</p><h3>Saved on this browser</h3><p>Your progress and statistics stay on this device and browser. The web version does not sync with the iOS app or iCloud.</p><p class="subtle">Color theme follows your device settings. Add Words Link to your home screen for an app-like experience.</p>`);for(const [id,hard]of[['normal-mode',false],['hard-mode',true]])$(id).onclick=()=>{if(!checkDay()||locked())return;session.hard=hard;save();render();$('modal').close();};};
$('credits').onclick=()=>modal('<h2>Good words. Good company.</h2><p>Synonyms from <a href="https://en-word.net/" target="_blank" rel="noopener">Open English WordNet 2025</a>, derived from Princeton WordNet. Adapted into a synonym-only graph for offline play.</p><p>© Open English WordNet contributors and Princeton University. Open English WordNet is licensed under CC BY 4.0; Princeton’s original license also applies.</p><p><a href="data/Licenses.txt" target="_blank">Full credits and licenses ↗</a> · <a href="data/Provenance.json" target="_blank">Data provenance ↗</a></p><p>Dictionary lookups use Wiktionary in a new tab. Puzzle play uses the bundled dictionary, without a third-party API.</p>');
function shiftDay(day,amount){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
$('scoreboard').onclick=()=>{
 const days=new Set(history.map(f=>f.day));let streak=0,d=days.has(dailyKey())?dailyKey():shiftDay(dailyKey(),-1);while(days.has(d)){streak++;d=shiftDay(d,-1);}
 let longest=0,run=0,previous;for(const date of [...days].sort()){run=previous&&shiftDay(previous,1)===date?run+1:1;longest=Math.max(longest,run);previous=date;}
 const perfect=history.filter(f=>!f.assisted&&f.route.length-2===f.par).length;
 const words=history.flatMap(f=>f.route.slice(1,-1));
 const values=[['Lifetime points',history.reduce((s,f)=>s+f.points,0)],['Recorded finishes',history.length],['Current streak',streak],['Longest streak',longest],['Perfect routes',perfect],['Perfect rate',`${history.length?Math.round(perfect/history.length*100):0}%`],['Best round',Math.max(0,...history.map(f=>f.points))],['Average bridge words',history.length?(words.length/history.length).toFixed(1):0],['Unique bridge words',new Set(words).size],['Hard finishes',history.filter(f=>f.hard).length],['Assisted finishes',history.filter(f=>f.assisted).length],['Undos used',history.reduce((s,f)=>s+f.undos,0)]];
 modal(`<h2>Your word story</h2><p class="subtle">Saved on this browser.</p>${!history.length?'<p>Your next bridge starts the story. Finish a puzzle to fill your calendar and unlock milestones.</p>':''}<div class="metrics">${values.map(([label,value])=>`<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><h3>Your play calendar</h3><div id="calendar"></div><h3>Little wins, big energy</h3>${[['First link',history.length,1],['On a roll',longest,3],['Week of words',longest,7],['No detours',perfect,10],['Hard worker',history.filter(f=>f.hard).length,10],['Word collector',new Set(words).size,100],['Four figures',history.reduce((s,f)=>s+f.points,0),1000],['Bridge builder',history.length,100]].map(([label,value,max])=>`<div class="milestone"><label>${label} · ${Math.min(value,max)}/${max}</label><progress value="${value}" max="${max}" aria-label="${label}"></progress></div>`).join('')}<h3>Your bridge book</h3>${[...history].reverse().map((f,i)=>`<details><summary>${escape(f.route[0])} → ${escape(f.route.at(-1))}<br><small>${f.day} · ${f.hard?'Hard':'Normal'} · ${f.points} pts</small></summary><p>${f.route.map(escape).join(' → ')}</p><p>${f.route.length-2} bridge words · Par ${f.par}<br>${f.undos} undos · ${f.misses} missed guesses${f.assisted?' · Assisted':''}</p><button data-share="${history.length-1-i}">Share results ↗</button></details>`).join('')}`);
 document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>share(history[Number(b.dataset.share)]));
 let month=new Date(dailyKey()+'T12:00:00Z');month.setUTCDate(1);
 function calendar(){const y=month.getUTCFullYear(),m=month.getUTCMonth(),offset=month.getUTCDay(),n=new Date(Date.UTC(y,m+1,0)).getUTCDate();$('calendar').innerHTML=`<div class="calendar-nav"><button id="prev-month" aria-label="Previous month">‹</button><strong>${month.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button id="next-month" aria-label="Next month">›</button></div><div class="calendar">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:n},(_,i)=>{const date=`${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;return `<button class="${days.has(date)?'played':''} ${date===dailyKey()?'today':''}" data-day="${date}" aria-label="${date}${days.has(date)?', completed':''}">${i+1}</button>`;}).join('')}</div><p id="calendar-detail" class="subtle">Tap a day to explore.</p>`;$('prev-month').onclick=()=>{month.setUTCMonth(m-1);calendar();};$('next-month').onclick=()=>{month.setUTCMonth(m+1);calendar();};document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{const f=history.find(f=>f.day===b.dataset.day);$('calendar-detail').textContent=f?`${f.day}: ${f.route.join(' → ')} · ${f.points} points`:`${b.dataset.day}: No finish recorded.`;});}calendar();
};
async function init(){try{const responses=await Promise.all(['Synonyms.json','DailyChallenges.json'].map(name=>fetch(`data/${name}`)));if(responses.some(r=>!r.ok))throw Error('Data unavailable');const [database,challenges]=await Promise.all(responses.map(r=>r.json()));links=createGraph(database);schedule=challenges;startDay();}catch{$('game').innerHTML='<h2>Couldn’t load the word dictionary.</h2><p>Check your connection and try again.</p><button id="retry">Try again</button>';$('retry').onclick=init;$('game').setAttribute('aria-busy','false');}}
window.addEventListener('focus',()=>{if(schedule&&day!==dailyKey())startDay();});
setInterval(()=>{if(schedule&&day!==dailyKey())startDay();},30000);
window.addEventListener('storage',e=>{if(e.key?.startsWith('words-link.')){history=read('words-link.history.v1',[]);if(schedule)startDay();}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
init();
