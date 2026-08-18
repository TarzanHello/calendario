// Scarica i calendari iCal di Booking e aggiorna data.json.
// In più tiene un piccolo LOG di ogni aggiornamento:
//   - log.txt     -> registro leggibile (ultimi run), da aprire quando vuoi
//   - status.json -> stato dell'ultimo run, mostrato anche nell'app
// Gli URL iCal NON stanno qui: arrivano dai "secrets" di GitHub.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const HOUSES = [
  { id: 'h1', name: 'Arriano', env: 'BOOKING_ICAL_H1' },
  { id: 'h2', name: 'Labieno', env: 'BOOKING_ICAL_H2' },
];

const MAX_LOG_RUNS = 30;                 // quanti aggiornamenti tenere nel log
const SEP = '========================================';

// ---------- mini-parser iCal (nessuna libreria esterna) ----------
function parseICS(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur && cur.start && cur.end) events.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i), val = line.slice(i + 1).trim();
      if (key.startsWith('DTSTART')) cur.start = toISO(val);
      else if (key.startsWith('DTEND')) cur.end = toISO(val);
    }
  }
  return events;
}
function toISO(v) {
  const d = v.slice(0, 8);
  return /^\d{8}$/.test(d) ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : null;
}

async function fetchHouse(url) {
  const t0 = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': 'github-actions-calendar-sync' } });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.secs = secs; throw e; }
  const text = await res.text();
  const events = parseICS(text)
    .map(e => ({ start: e.start, end: e.end }))
    .filter(e => e.start && e.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const seen = new Set();
  const ranges = events.filter(e => {
    const k = e.start + '_' + e.end;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  return { ranges, secs, status: res.status };
}

// ---------- carica i dati precedenti (per non perderli in caso di errore) ----------
let prev = { houses: {} };
if (existsSync('data.json')) { try { prev = JSON.parse(readFileSync('data.json', 'utf8')); } catch {} }

const now = new Date();
const out = { updated: now.toISOString(), houses: {} };
const status = { time: now.toISOString(), ok: true, houses: {} };
const lines = [];
let okCount = 0, errCount = 0;

for (const h of HOUSES) {
  const url = process.env[h.env];
  const prevRanges = (prev.houses && prev.houses[h.id]) || [];

  if (!url) {
    out.houses[h.id] = prevRanges;
    status.houses[h.id] = { ok: false, count: prevRanges.length, info: `secret ${h.env} mancante` };
    status.ok = false;
    lines.push(`Casa ${h.id} (${h.name}): SALTATA · secret ${h.env} non impostato · tengo i dati precedenti (${prevRanges.length})`);
    continue;
  }

  try {
    const r = await fetchHouse(url);
    out.houses[h.id] = r.ranges;
    status.houses[h.id] = { ok: true, count: r.ranges.length, info: `HTTP ${r.status}` };
    okCount++;
    lines.push(`Casa ${h.id} (${h.name}): OK · ${r.ranges.length} prenotazioni · HTTP ${r.status} · ${r.secs}s`);
  } catch (err) {
    out.houses[h.id] = prevRanges;                 // <-- NON cancello le date buone
    status.houses[h.id] = { ok: false, count: prevRanges.length, info: `${err.message} — dati precedenti mantenuti` };
    status.ok = false;
    errCount++;
    lines.push(`Casa ${h.id} (${h.name}): ERRORE · ${err.message} · mantengo i dati precedenti (${prevRanges.length})`);
  }
}

const esito = errCount === 0 && okCount === HOUSES.length ? 'OK'
            : (okCount > 0 ? 'PARZIALE' : 'ERRORE');
if (esito !== 'OK') status.ok = false;

// ---------- scrivi i file ----------
writeFileSync('data.json', JSON.stringify(out, null, 2) + '\n');
writeFileSync('status.json', JSON.stringify(status, null, 2) + '\n');

// registro leggibile: aggiungo in cima il run di adesso e taglio i più vecchi
const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const block = [SEP, `${stamp}  —  ESITO: ${esito}`, '-'.repeat(40),
  ...lines, `Riepilogo: ${okCount} aggiornate, ${errCount} con errore.`, ''].join('\n');

let old = '';
if (existsSync('log.txt')) { try { old = readFileSync('log.txt', 'utf8'); } catch {} }
const runs = (block + '\n' + old).split(SEP).filter(s => s.trim());
const log = runs.slice(0, MAX_LOG_RUNS).map(r => SEP + r).join('');
writeFileSync('log.txt', log);

console.log(block);
console.log(`Fatto. Esito: ${esito}.`);
