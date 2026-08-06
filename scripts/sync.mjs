// Scarica i calendari iCal di Booking e scrive data.json.
// Gli URL iCal NON stanno qui: arrivano dai "secrets" di GitHub,
// così restano privati. Ogni casa ha il suo secret.

import { writeFileSync } from 'node:fs';

const HOUSES = [
  { id: 'h1', env: 'BOOKING_ICAL_H1' },
  { id: 'h2', env: 'BOOKING_ICAL_H2' },
];

// --- mini-parser iCal (nessuna libreria esterna) ---
function parseICS(text) {
  // "unfold": le righe che iniziano con spazio/tab sono continuazioni
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur && cur.start && cur.end) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1).trim();
      if (key.startsWith('DTSTART')) cur.start = toISO(val);
      else if (key.startsWith('DTEND')) cur.end = toISO(val);
    }
  }
  return events;
}

function toISO(v) {
  const d = v.slice(0, 8); // YYYYMMDD, ignora eventuale orario
  return /^\d{8}$/.test(d) ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : null;
}

async function fetchHouse(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'github-actions-calendar-sync' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const events = parseICS(text)
    .map(e => ({ start: e.start, end: e.end }))
    .filter(e => e.start && e.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  // deduplica intervalli identici
  const seen = new Set();
  return events.filter(e => {
    const k = e.start + '_' + e.end;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

const out = { updated: new Date().toISOString(), houses: {} };

for (const h of HOUSES) {
  const url = process.env[h.env];
  if (!url) {
    console.log(`· ${h.id}: nessun URL (secret ${h.env} non impostato) → salto`);
    out.houses[h.id] = [];
    continue;
  }
  try {
    out.houses[h.id] = await fetchHouse(url);
    console.log(`✓ ${h.id}: ${out.houses[h.id].length} prenotazioni`);
  } catch (err) {
    console.error(`✗ ${h.id}: ${err.message}`);
    out.houses[h.id] = [];
    process.exitCode = 1; // segnala l'errore ma scrive comunque il file
  }
}

writeFileSync('data.json', JSON.stringify(out, null, 2) + '\n');
console.log('data.json aggiornato.');
