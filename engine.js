export function dailyKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function points(par, count, hard, assisted) {
  return assisted || par < 3 || par > 10 || count < par ? 0 : (100 + 10 * par + Math.max(0, 50 - 10 * (count - par))) * (hard ? 2 : 1);
}
export function createGraph(data) {
  const indices = new Map(data.words.map((w,i) => [w,i]));
  return word => (data.neighbors[indices.get(word)] || []).map(i => data.words[i]);
}
export async function tiles(choices, current, target, solution, day) {
  const next = solution[solution.indexOf(current) + 1];
  const reserved = choices.filter(w => w === target || w === next);
  const encoder = new TextEncoder();
  const ranked = await Promise.all(choices.filter(w => !reserved.includes(w)).map(async word => {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${day}|${current}|${word}`));
    return {word, rank:Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('')};
  }));
  ranked.sort((a,b) => a.rank.localeCompare(b.rank) || a.word.localeCompare(b.word));
  return [...reserved, ...ranked.slice(0,12-reserved.length).map(x => x.word)].sort();
}
export function validPrefix(path, start, links) {
  if (!Array.isArray(path) || path[0] !== start) return [start];
  const result = [start];
  for (const word of path.slice(1)) {
    if (result.includes(word) || !links(result.at(-1)).includes(word)) break;
    result.push(word);
  }
  return result;
}
export function shareText(finish) {
  const count = finish.route.length - 2;
  const tiles = ['⬜', ...Array(count).fill(finish.hard ? '🟪':'🟩'), '🟨'];
  const rows = [];
  for(let i=0;i<tiles.length;i+=8) rows.push(tiles.slice(i,i+8).join(''));
  return `Words Link · ${finish.day} · ${finish.hard ? 'Hard':'Normal'}\n${count} bridge words · Par ${finish.par} · ${finish.points} pts${finish.assisted ? ' · Assisted':''}\n${rows.join('\n')}\n\nCan you make today’s link?\n${globalThis.location?.href || ''}`;
}
