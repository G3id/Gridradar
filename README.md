# SchrottRadar MVP

Dezentrale/verteilebare Schrott-Melde-App mit:

- öffentlicher Kundenseite `/report`
- Adminbereich `/admin`
- Händler/Fahrerbereich `/dealer`
- Standort, Zeitstempel, Foto, Beschreibung
- 2 Admin-Logins möglich
- Fahrer/Händler im Adminbereich anlegen
- Händler sehen nur zugewiesene Aufträge
- Kunden sehen keine Fahrer-Auswahl
- Supabase RLS-Sicherheit

## 1. Supabase vorbereiten

1. Neues Supabase-Projekt erstellen.
2. `supabase/schema.sql` im SQL Editor ausführen.
3. In Supabase Auth zwei Admin-Benutzer manuell erstellen.
4. In `profiles` für diese beiden Benutzer Rollen setzen:
   - erster Admin: `super_admin`
   - zweiter Admin: `admin`

Beispiel steht unten in `schema.sql`.

## 2. Edge Function deployen

Die Funktion ist nötig, damit Admins neue Fahrer/Händler sicher anlegen können.

```bash
supabase functions deploy create-dealer
```

Die Function braucht diese Secrets:

```bash
supabase secrets set SUPABASE_URL="https://DEIN-PROJEKT.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="DEIN_ANON_KEY"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="DEIN_SERVICE_ROLE_KEY"
```

Den Service Role Key niemals ins Frontend packen.

## 3. Frontend starten

`.env.example` zu `.env` kopieren:

```bash
cp .env.example .env
```

Werte eintragen:

```env
VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=DEIN_SUPABASE_ANON_KEY
```

Installieren und starten:

```bash
npm install
npm run dev
```

## 4. Seiten

- Öffentlich: `http://localhost:5173/report`
- Login: `http://localhost:5173/login`
- Admin: `http://localhost:5173/admin`
- Händler: `http://localhost:5173/dealer`

## 5. Sicherheitsmodell

Kunden:
- dürfen nur neue Meldungen anlegen
- dürfen keine Aufträge lesen
- sehen keine Händler/Fahrer

Admins:
- sehen alle Meldungen
- legen Fahrer an
- weisen Aufträge zu
- sehen Fotos

Händler/Fahrer:
- sehen nur zugewiesene Aufträge
- sehen nur Fotos ihrer eigenen Aufträge
- können Status ändern

## 6. Benachrichtigung

Im MVP erscheinen Benachrichtigungen im Händlerbereich. Für echte Push-Benachrichtigungen kannst du danach ntfy, E-Mail oder Web Push ergänzen.
