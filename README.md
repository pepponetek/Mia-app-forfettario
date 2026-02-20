# 🧾 ForfettarioApp

> Calcolatore fiscale per il **Regime Forfettario** italiano — sviluppato da **Peppone Tek**

[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![JavaScript](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-Proprietaria-red)](#licenza)

---

## Indice

- [Panoramica](#panoramica)
- [Funzionalità principali](#funzionalit%C3%A0-principali)
- [Stack tecnologico](#stack-tecnologico)
- [Struttura del progetto](#struttura-del-progetto)
- [Configurazione iniziale](#configurazione-iniziale)
- [Schema del database](#schema-del-database)
- [Logica fiscale](#logica-fiscale)
- [Autenticazione](#autenticazione)
- [Sicurezza](#sicurezza)
- [Funzionalità future](#funzionalit%C3%A0-future)
- [Licenza](#licenza)

---

## Panoramica

**ForfettarioApp** è una web application single-page (SPA) che aiuta i titolari di partita IVA in regime forfettario a:

- **Calcolare** imposte, contributi INPS e acconti in modo preciso
- **Archiviare** lo storico fiscale anno per anno in modo sicuro nel cloud
- **Visualizzare** statistiche e grafici di andamento pluriennale
- **Pianificare** le scadenze fiscali attraverso uno scadenzario automatico
- **Esportare** fascicoli fiscali in PDF per ogni anno

L'app è pensata per l'uso diretto da parte del contribuente o da parte di un consulente/amministratore (Peppone Tek) che gestisce i profili dei propri clienti.

---

## Funzionalità principali

### Calcolo fiscale
- Riconoscimento automatico del gruppo ATECO dal codice inserito
- Calcolo del **reddito forfettario** in base al coefficiente di redditività del gruppo
- Calcolo dei **contributi INPS** (Gestione Separata, Artigiani, Commercianti, Cassa Professionale)
- Opzione di deduzione INPS dal reddito imponibile (art. 1 c. 64 L. 190/2014)
- Calcolo dell'**imposta sostitutiva** (15% ordinario, 5% agevolato primi 5 anni)
- **Proiezione a fine anno** quando si lavora in corso d'anno (mese di riferimento)
- Calcolo degli **acconti** per l'anno successivo con soglie di esonero corrette

### Storico e archivio
- Salvataggio cloud sicuro via Supabase (PostgreSQL con RLS)
- Archivio anni fiscali con stato: **Bozza** o **Archiviato**
- Wizard guidato alla prima registrazione: inserimento degli ultimi 4 anni precedenti
- Aggiornamento imponibile per anni in stato Bozza con ricalcolo automatico

### Visualizzazioni e report
- **Mini grafici** nell'archivio: barre proporzionali per Fatturato / Oneri / Netto disponibile con variazione % anno su anno
- **Statistiche**: grafici Chart.js pluriennali su fatturato, imposte, INPS e netto
- **Confronto anni**: analisi side-by-side di due anni fiscali
- **F24 anni precedenti**: riepilogo scadenze e importi per anni archiviati

### Stampa e PDF
- Export PDF del fascicolo fiscale per anno (jsPDF, charset WinAnsi-safe)
- Stampa selettiva di un singolo anno dall'archivio
- Stampa del calcolo corrente

### Calendario scadenze
- Scadenzario automatico generato dai dati salvati
- Filtra gli anni archiviati: mostra solo l'anno corrente e futuri

### Pannello amministratore
- Visibile solo agli utenti con `ruolo = 'admin'`
- Anagrafica clienti (nome, cognome, email, ATECO, data iscrizione)
- Nessun dato fiscale esposto nell'admin — solo dati anagrafici
- Export CSV dell'anagrafica

---

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JavaScript (ES2022) |
| Backend/Auth | [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS) |
| Grafici | [Chart.js 4.4](https://www.chartjs.org/) |
| PDF | [jsPDF 2.5.1](https://parall.ax/products/jspdf) |
| Hosting | Qualsiasi server statico / GitHub Pages / Netlify |

L'app è un **singolo file `index.html`** senza build step, senza framework, senza dipendenze npm. Tutte le librerie sono caricate da CDN.

---

## Struttura del progetto

```
forfettario-app/
├── index.html          # Intera applicazione (HTML + CSS + JS)
└── README.md           # Questa documentazione
```

### Struttura interna di `index.html`

```
index.html
├── <head>
│   ├── CDN: supabase-js, chart.js, jspdf
│   └── <style> — tutto il CSS dell'app
├── <body>
│   ├── #auth-screen       — Login / Registrazione (email + Google OAuth)
│   └── #app
│       ├── .sidebar       — navigazione, lista anni, azioni
│       └── .content
│           ├── #view-calcolo    — form calcolo + risultati
│           ├── #view-archivio   — storico anni con dettagli espandibili
│           ├── #view-grafici    — statistiche visive Chart.js
│           ├── #view-calendario — scadenzario
│           ├── #view-confronto  — comparazione due anni
│           ├── #view-f24        — F24 anni precedenti
│           └── #view-admin      — pannello admin (solo ruolo admin)
│
├── Modali:
│   ├── #modal-del         — conferma eliminazione anno
│   ├── #modal-stato       — cambio stato (Bozza / Archiviato)
│   ├── #modal-bozza       — aggiornamento imponibile anno in bozza
│   └── #wiz-overlay       — wizard inserimento anni precedenti
│
└── <script>
    ├── Costanti fiscali (GRUPPI, ATECO_DB, INPS_INFO)
    ├── Stato globale (_user, _profile, _anni, _last)
    ├── Funzioni calcolo (calcola, renderRisultati)
    ├── Funzioni cloud (salvaAnno, confDel, cambiaStato)
    ├── Funzioni UI (showView, renderArchivio, renderGrafici…)
    ├── Funzioni PDF (exportPDF)
    ├── Wizard storico (wizOpen, wizNext, wizComplete…)
    └── Boot (onAuthStateChange, initApp)
```

---

## Configurazione iniziale

### 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto
2. Annota **Project URL** e **anon key** dalla sezione *Settings → API*

### 2. Esegui il setup del database

Apri l'**SQL Editor** di Supabase ed esegui le seguenti migration in ordine:

```sql
-- Tabella profili utente
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  nome        TEXT DEFAULT '',
  cognome     TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  ruolo       TEXT DEFAULT 'cliente' CHECK (ruolo IN ('admin','cliente')),
  ateco       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella anni fiscali
CREATE TABLE public.anni_fiscali (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users NOT NULL,
  anno             INTEGER NOT NULL,
  stato            TEXT DEFAULT 'bozza' CHECK (stato IN ('bozza','archiviato')),
  ateco            TEXT DEFAULT '',
  gruppo_idx       SMALLINT,
  gruppo_nome      TEXT DEFAULT '',
  coefficiente     NUMERIC DEFAULT 0,
  aliquota         NUMERIC DEFAULT 0.15,
  inps_tipo        TEXT DEFAULT 'gs',
  inps_desc        TEXT DEFAULT '',
  deduci_inps      BOOLEAN DEFAULT TRUE,
  mese_rif         SMALLINT DEFAULT 12,
  note             TEXT DEFAULT '',
  fatturato        NUMERIC DEFAULT 0,
  reddito_forf     NUMERIC DEFAULT 0,
  contributi_inps  NUMERIC DEFAULT 0,
  reddito_imp      NUMERIC DEFAULT 0,
  imposta_sost     NUMERIC DEFAULT 0,
  totale_oneri     NUMERIC DEFAULT 0,
  acconto_1        NUMERIC DEFAULT 0,
  acconto_2        NUMERIC DEFAULT 0,
  acconto_tot      NUMERIC DEFAULT 0,
  acconto_note     TEXT DEFAULT '',
  salvato_il       TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, anno)
);

-- Tabella sessioni (analytics opzionale)
CREATE TABLE public.sessioni (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users,
  accesso_il   TIMESTAMPTZ DEFAULT NOW(),
  user_agent   TEXT DEFAULT '',
  calcoli_fatti INTEGER DEFAULT 0,
  anni_salvati  INTEGER DEFAULT 0
);
```

```sql
-- Abilita Row Level Security su tutte le tabelle
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anni_fiscali  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessioni      ENABLE ROW LEVEL SECURITY;

-- Funzione helper is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo = 'admin'
  );
$$;

-- Policy per profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy per anni_fiscali
CREATE POLICY "af_select_own_or_admin" ON public.anni_fiscali
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "af_insert_own" ON public.anni_fiscali
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "af_update_own" ON public.anni_fiscali
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "af_delete_own" ON public.anni_fiscali
  FOR DELETE USING (auth.uid() = user_id);

-- Policy per sessioni
CREATE POLICY "sess_insert_own"  ON public.sessioni FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sess_update_own"  ON public.sessioni FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sess_admin_all"   ON public.sessioni FOR SELECT USING (is_admin());
```

```sql
-- Trigger: crea profilo automatico al signup (email + Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome TEXT; v_cognome TEXT; v_full TEXT;
BEGIN
  v_nome    := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome',''), NEW.raw_user_meta_data->>'given_name','');
  v_cognome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'cognome',''), NEW.raw_user_meta_data->>'family_name','');
  IF v_nome = '' THEN
    v_full    := COALESCE(NEW.raw_user_meta_data->>'full_name','');
    IF v_full <> '' THEN
      v_nome    := split_part(v_full,' ',1);
      v_cognome := COALESCE(NULLIF(substring(v_full FROM position(' ' IN v_full)+1),''),'');
    END IF;
  END IF;
  INSERT INTO public.profiles (id, nome, cognome, email, ruolo, ateco)
  VALUES (NEW.id, v_nome, v_cognome, COALESCE(NEW.email,''), 'cliente', COALESCE(NEW.raw_user_meta_data->>'ateco',''))
  ON CONFLICT (id) DO UPDATE
    SET email   = EXCLUDED.email,
        nome    = CASE WHEN profiles.nome    = '' THEN EXCLUDED.nome    ELSE profiles.nome    END,
        cognome = CASE WHEN profiles.cognome = '' THEN EXCLUDED.cognome ELSE profiles.cognome END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: aggiorna updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER anni_fiscali_updated_at BEFORE UPDATE ON public.anni_fiscali
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3. Configura le credenziali nell'app

Apri `index.html` e individua l'inizializzazione di Supabase (circa riga 905):

```javascript
const sb = supabase.createClient(
  'https://TUO_PROJECT_REF.supabase.co',
  'TUA_ANON_KEY'
);
```

Sostituisci con il tuo **Project URL** e **anon key**.

### 4. Configura il Google OAuth (opzionale)

**Su Google Cloud Console:**
1. Crea un progetto → *API e servizi → Credenziali → Crea credenziali → ID client OAuth 2.0*
2. Tipo applicazione: **Applicazione web**
3. Origini JavaScript autorizzate: `https://TUO_PROJECT_REF.supabase.co`
4. URI di reindirizzamento: `https://TUO_PROJECT_REF.supabase.co/auth/v1/callback`

**Su Supabase Dashboard:**
1. *Authentication → Providers → Google* → abilita il toggle
2. Inserisci **Client ID** e **Client Secret** ottenuti da Google

**In Supabase → Authentication → URL Configuration:**
- Aggiungi nei *Redirect URLs* l'URL dove è ospitata l'app (es. `https://tuodominio.com`)

### 5. Crea l'utente admin

Dopo aver creato il primo account, esegui su Supabase:

```sql
UPDATE public.profiles
SET ruolo = 'admin'
WHERE email = 'tua@email.com';
```

---

## Schema del database

```
┌─────────────────────────────────────────────────────────┐
│  auth.users (gestito da Supabase Auth)                  │
│  id · email · raw_user_meta_data                        │
└───────────────┬─────────────────────────────────────────┘
                │ FK: id → profiles.id
                │ FK: id → anni_fiscali.user_id
                │ FK: id → sessioni.user_id
                ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  profiles            │    │  anni_fiscali                │
│──────────────────────│    │──────────────────────────────│
│  id (PK)             │    │  id (PK, UUID)               │
│  nome                │    │  user_id (FK)                │
│  cognome             │    │  anno (INT)                  │
│  email               │    │  stato (bozza/archiviato)    │
│  ruolo               │    │  ateco, gruppo_idx           │
│  ateco               │    │  coefficiente, aliquota      │
│  created_at          │    │  inps_tipo, inps_desc        │
│  updated_at          │    │  fatturato, reddito_forf     │
└──────────────────────┘    │  contributi_inps             │
                            │  imposta_sost, totale_oneri  │
                            │  acconto_1, acconto_2        │
                            │  note, mese_rif              │
                            │  salvato_il, updated_at      │
                            │  UNIQUE(user_id, anno)       │
                            └──────────────────────────────┘
```

---

## Logica fiscale

### Gruppi ATECO e coefficienti di redditività

| Gruppo | Attività | Coeff. | INPS |
|--------|----------|--------|------|
| 1 | Industrie alimentari e bevande | 40% | Artigiani |
| 2 | Commercio ingrosso e dettaglio | 40% | Commercianti |
| 3 | Commercio ambulante alimentare | 40% | Commercianti |
| 4 | Commercio ambulante altri prod. | 54% | Commercianti |
| 5 | Costruzioni e attività immobiliari | **86%** | Gest. Separata |
| 6 | Intermediari del commercio | 62% | Commercianti |
| 7 | Alloggio e ristorazione | 40% | Artigiani |
| 8 | Professionali, scientifiche, sanitarie | 78% | Gest. Separata |
| 9 | Altre attività economiche | 67% | Gest. Separata |

### Calcolo passo per passo

```
Fatturato imponibile
        ↓ × coefficiente
Reddito forfettario
        ↓ − contributi INPS (se deduci_inps = true)
Reddito imponibile netto
        ↓ × aliquota (15% o 5%)
Imposta sostitutiva
        ↓ + contributi INPS
Totale oneri
        ↓
Netto disponibile = Fatturato − Totale oneri
```

### Contributi INPS

| Gestione | Calcolo |
|----------|---------|
| Gest. Separata (26,07%) | `reddito_forfettario × 0.2607` |
| Gest. Separata pensionato (24%) | `reddito_forfettario × 0.24` |
| Artigiani | `€4.208,40 fisso + 24% sulla parte eccedente €17.504` |
| Commercianti | `€4.292,42 fisso + 24,48% sulla parte eccedente €17.504` |
| Cassa Professionale | aliquota manuale impostata dall'utente |

### Acconti anno successivo

- **Esonero** se imposta sostitutiva ≤ €51,65
- **Acconto unico** (100%) a novembre se totale ≤ €257,52
- **Due rate** se totale > €257,52: 40% a giugno + 60% a novembre

### Limite forfettario

Il limite di fatturato è **€85.000** (L. 190/2014 e successive modifiche). L'app segnala:
- ⚠️ Avviso quando la proiezione supera l'80% del limite
- 🚨 Allerta quando la proiezione supera il limite

---

## Autenticazione

L'app supporta due metodi di accesso:

**Email + Password** (Supabase Auth)
- Registrazione con nome, cognome, email, password, ATECO (opzionale)
- Reset password via email

**Google OAuth**
- Login / registrazione con account Google
- Il trigger `handle_new_user` legge `given_name` / `family_name` / `full_name` dai metadati Google

### Wizard storico (primo accesso)

Al primo salvataggio, se l'utente non ha anni precedenti, un wizard guidato propone di inserire i dati dei **4 anni fiscali precedenti**. Ogni anno viene salvato automaticamente come **Archiviato**. È possibile saltare uno o tutti gli anni.

---

## Sicurezza

- **Row Level Security (RLS)** attiva su tutte le tabelle: ogni utente accede solo ai propri dati
- **Funzione `is_admin()`** eseguita lato database per elevazione di privilegio admin
- **Pannello admin** espone solo dati anagrafici, mai dati fiscali dei clienti
- **Input sanitization**: la funzione `sanitizeHTML()` previene XSS su tutti i dati visualizzati
- **Validazione lato client** su tutti i form (fatturato, ATECO, email, password)
- **Sicurezza extra** sulle query di update/delete: `.eq('user_id', _user.id)` anche se la RLS lo garantisce già

---

## Funzionalità future

- [ ] Notifiche push per le scadenze fiscali
- [ ] Import fatture da file CSV/XML
- [ ] Integrazione con SDI per la fatturazione elettronica
- [ ] Supporto multi-partita IVA per lo stesso utente
- [ ] App mobile (PWA)
- [ ] Report personalizzati per il commercialista

---

## Licenza

Proprietaria — © Peppone Tek. Tutti i diritti riservati.

L'applicazione è uno strumento informativo. Le stime fiscali sono basate su L. 190/2014 e successive modifiche, aliquote INPS 2024. **Consultare sempre un commercialista abilitato** per la gestione fiscale ufficiale.

---

<p align="center">
  Sviluppato con ❤️ da <strong>Peppone Tek</strong>
</p>
