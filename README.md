# Disponibilità Case Vacanze

Calendario unico delle due case, con le date occupate importate in automatico da Booking.com.
Nessun database, nessun login: GitHub scarica i calendari e il sito li mostra.

## Struttura dei file

- `index.html` — il sito (calendario). Qui in cima puoi cambiare **nomi e colori** delle case.
- `data.json` — le date occupate. **Non modificarlo a mano**: lo aggiorna GitHub.
- `scripts/sync.mjs` — scarica i calendari di Booking.
- `.github/workflows/sync.yml` — automatismo che gira ogni 3 ore.

## Come attivarlo (una volta sola)

### 1. Prendi i due link iCal da Booking
Per **ogni** casa, nell'Extranet di Booking.com:
`Tariffe e disponibilità` → `Calendario` → riquadro `Sincronizza calendari` sotto il calendario →
`Esporta calendario` → `Copia link`.
Ottieni due link che finiscono in `.ics` (uno per casa). Tienili da parte.

> ⚠️ Questi link sono privati: chi li ha può vedere le tue disponibilità. Non pubblicarli.

### 2. Mettili nei "secrets" di GitHub
Nel repository: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.
Crea due secret:
- `BOOKING_ICAL_H1` = link della prima casa
- `BOOKING_ICAL_H2` = link della seconda casa

### 3. Personalizza i nomi
In `index.html`, in cima allo script, cambia `name` e `color` delle due case.

### 4. Lancia il primo aggiornamento
`Actions` → `Aggiorna disponibilità da Booking` → `Run workflow`.
Dopo qualche secondo `data.json` si popola e il sito mostra le prenotazioni.
Da lì in poi si aggiorna da solo ogni 3 ore.

### 5. Pubblica il sito
`Settings` → `Pages` → Source: ramo `main`, cartella `/ (root)` → `Save`.
Dopo 1–2 minuti avrai il link da condividere con gli addetti pulizie.

## Note
- Le date di Booking si aggiornano ogni poche ore, non in tempo reale.
- `data.json` contiene solo date, nessun dato dell'ospite.
- Se il repository è pubblico, quelle date sono visibili a chi trova il link.
  Per tenerle private serve un repository privato con un piano GitHub a pagamento (per le Pages).
