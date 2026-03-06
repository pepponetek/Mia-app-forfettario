# 🧾 ForfettarioApp — Calcolatore Fiscale Regime Forfettario

> **Progetto:** Peppone Tek  
> **Stack:** Vanilla HTML/JS · Supabase · Google Gemini AI · Vercel  
> **Versione motore:** 3.0  

---

## 📌 Cos'è

ForfettarioApp è una **Single Page Application** (file `app.html`) che aiuta i professionisti italiani in regime forfettario (L. 190/2014) a:

- Calcolare **imposta sostitutiva**, **contributi INPS** e **acconti F24** con precisione deterministica
- Parsare automaticamente le **Dichiarazioni dei Redditi PF** e gli **F24** caricati in PDF tramite AI
- Generare un **facsimile F24** da stampare con tutti i codici tributo precompilati
- Monitorare il **limite di fatturato** (85.000€ / 100.000€) con alert in tempo reale
- Archiviare lo **storico fiscale pluriennale** su cloud per proiezioni affidabili

L'app è progettata per affiancare, non sostituire, il lavoro di un commercialista.

---

## 🏗️ Architettura

```
app.html (Single File App)
│
├── UI Layer          — HTML/CSS dark theme, responsive mobile-first
├── Motore Fiscale    — calcola() — logica deterministica pura (no AI)
├── Parser PDF        — pdf.js + tryParseRPF / tryParseF24 (locale)
├── AI Parser         — Google Gemini Flash (fallback se parser locale fallisce)
├── F24 Overlay       — stampa facsimile su immagine ufficiale (base64)
│
├── Supabase Backend
│   ├── auth          — Email/password, JWT, RLS attivo
│   ├── anni_fiscali  — storico calcoli per utente
│   ├── tax_rules     — coefficienti ATECO e aliquote
│   ├── tax_mapping_ade — mappatura righi LM per anno (dinamica)
│   └── profiles      — dati utente + flag is_admin
│
└── Vercel            — deploy statico, env vars protette
```

---

## ⚙️ Motore di Calcolo (Logica Deterministica)

Il motore non delega mai i calcoli fiscali all'AI. Segue rigorosamente:

### Formula base (art. 1 c. 64 L. 190/2014)

```
Reddito Forfettario  = Fatturato × Coefficiente ATECO
Imponibile Netto     = Reddito Forfettario − INPS dedotta (principio di cassa)
Imposta Sostitutiva  = Imponibile Netto × 5% (startup, primi 5 anni)
                                         × 15% (regime ordinario)
                       − Eccedenza LM43 (anni precedenti)
```

### Acconti Imposta Sostitutiva (art. 17 TUIR)

| Acconto | Percentuale | Scadenza | Codice F24 |
|---------|-------------|----------|------------|
| Saldo | 100% | 30 giugno anno+1 | 1792 |
| I Acconto | 40% | 30 giugno anno+1 | 1791 |
| II Acconto | 60% | 30 novembre anno+1 | 1791 |

> Esonero se imposta base ≤ €51,65 — gestito automaticamente.

### Acconti INPS Gestione Separata (P10)

```
Acconto INPS Tot  = Saldo INPS anno corrente × 80%
I rata  (40%)     → 30 giugno anno+2   — F24 cod. P10
II rata (40%)     → 30 novembre anno+2 — F24 cod. P10
```

---

## 🔔 Monitoraggio Soglie di Fatturato

| Soglia | Condizione | Alert |
|--------|-----------|-------|
| Normale | < 72.250€ (85% di 85k) | ✅ Verde |
| Attenzione | > 72.250€ | ⚠️ Giallo |
| Uscita anno prossimo | > 85.000€ | 🚨 Rosso |
| **Uscita immediata** | **> 100.000€** | **🔥 SFORAMENTO — IVA obbligatoria ora** |

La tripla soglia è attiva sia sul fatturato dichiarato (`r-lim`) che sulla proiezione 12 mesi (`r-proj`).

---

## 🤖 Parser PDF (AI + Locale)

### Flusso di parsing

```
PDF caricato
    │
    ├─► pdf.js — estrazione testo grezzo (tutte le pagine)
    │       └─► Ricerca keyword "QUADRO LM" / "Sezione II"
    │
    ├─► tryParseRPF()  — parser locale (Dichiarazione Redditi)
    │       └─► Mapping dinamico righi da tax_mapping_ade (LM22, LM35, LM39, LM43)
    │
    ├─► tryParseF24()  — parser locale multi-modulo (F24)
    │       ├─► Sezione ERARIO: codici 1790/1791/1792
    │       ├─► Sezione INPS:   codici P10/PXX/DPPI/CF**
    │       ├─► Filtro temporale: solo versamenti nell'anno solare target
    │       └─► Somma algebrica tutti i moduli nel PDF
    │
    └─► Gemini AI — fallback se parser locale non trova dati
            └─► Prompt dinamico buildExpertPrompt(anno, mapping)
```

### Codici tributo gestiti

| Codice | Tipo | Sezione | Uso |
|--------|------|---------|-----|
| 1790 | Saldo imposta sostitutiva | Erario | Scadenzario |
| 1791 | Acconto imposta sostitutiva | Erario | Scadenzario |
| 1792 | II Acconto imposta sostitutiva | Erario | Scadenzario |
| P10 | Contributi GS (reale) | INPS | Deducibile |
| PXX | Contributi GS (placeholder) | INPS | Deducibile |
| DPPI | Contributi GS (variante) | INPS | Deducibile |
| CF** | Contributi cassa | INPS | Deducibile |

---

## 🗄️ Schema Database (Supabase)

### `anni_fiscali`
Storico calcoli per utente, una riga per anno fiscale.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| `user_id` | uuid | FK → auth.users |
| `anno` | int | Anno fiscale |
| `fatturato` | numeric | Fatturato imponibile |
| `contributi_inps` | numeric | INPS calcolata |
| `imposta_sost` | numeric | Imposta sostitutiva netta |
| `acconto_1` | numeric | I acconto (40%) sostitutiva |
| `acconto_2` | numeric | II acconto (60%) sostitutiva |
| `acconto_inps_1` | numeric | I acconto INPS P10 (40%) |
| `acconto_inps_2` | numeric | II acconto INPS P10 (40%) |
| `acconto_inps_tot` | numeric | Totale acconto INPS P10 |
| `eccedenza_precedente` | numeric | Credito LM43 da anno prec. |
| `inps_versata_anno_solare` | numeric | INPS da F24 (principio cassa) |

### `tax_mapping_ade`
Mappatura righi dichiarazione per anno — gestibile da Admin senza toccare il codice.

| Anno | Fatturato | INPS | Imposta | Eccedenza |
|------|-----------|------|---------|-----------|
| 2023 | LM22 | LM35 | LM39 | LM43 |
| 2024 | LM22 | LM35 | LM39 | LM43 |
| 2025 | LM22 | LM35 | LM39 | LM43 |

### `tax_rules`
Coefficienti ATECO e aliquote — editabili da pannello Admin.

---

## 🛠️ Setup Locale / Deploy

### Variabili d'ambiente (Vercel)

```env
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
GEMINI_API_KEY=<gemini-api-key>
```

### Primo avvio

1. Carica `app.html` su Vercel (file statico, nessun build step)
2. Esegui le migration SQL in Supabase (vedi `/migrations/`)
3. Popola `tax_rules` con i coefficienti ATECO e `tax_mapping_ade` con i righi per anno
4. Crea il primo utente admin impostando `profiles.is_admin = true`

---

## 📋 Migration SQL (ordine di esecuzione)

```sql
-- 1. Tabella mapping righi AdE
CREATE TABLE IF NOT EXISTS public.tax_mapping_ade (
    anno int8 PRIMARY KEY,
    rigo_fatturato text DEFAULT 'LM22',
    rigo_inps_deducibile text DEFAULT 'LM35',
    rigo_imposta_sostitutiva text DEFAULT 'LM39',
    rigo_eccedenza text DEFAULT 'LM43',
    created_at timestamptz DEFAULT now()
);

-- 2. Colonna eccedenza su anni_fiscali
ALTER TABLE public.anni_fiscali
    ADD COLUMN IF NOT EXISTS eccedenza_precedente numeric DEFAULT 0;

-- 3. Colonne acconti INPS P10
ALTER TABLE public.anni_fiscali
    ADD COLUMN IF NOT EXISTS acconto_inps_1 numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS acconto_inps_2 numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS acconto_inps_tot numeric DEFAULT 0;
```

---

## 📁 Struttura File

```
/
├── app.html          — L'intera applicazione (single file)
├── index.html        — Landing page pubblica
├── termini.html      — Termini di servizio (16 articoli, cap zero euro)
├── privacy.html      — Privacy Policy GDPR (Reg. UE 2016/679)
├── README.md         — Questo file
└── Motore.md         — Specifiche architetturali (riferimento sviluppo)
```

---

## 📐 Note Fiscali Rilevanti

- **Marca da bollo**: se riaddebita al cliente in fattura, l'AdE la considera **ricavo imponibile** — sommarla al fatturato.
- **Contributo Soggettivo Cassa**: unico importo deducibile per i professionisti con cassa. Il Contributo Integrativo è neutro.
- **Principio di cassa INPS**: si deducono i contributi **effettivamente versati** nell'anno solare (da F24 pagati), non quelli stimati.
- **Eccedenza LM43**: credito da anni precedenti, sottratto automaticamente dal debito corrente per evitare overpayment.
- **Soglia 100.000€**: uscita dal regime **immediata** durante l'anno — obbligo IVA su tutte le fatture successive.

---

## ⚖️ Compliance

- **Fiscale**: L. 190/2014 art. 1 c. 64, DPR 633/72, art. 17 TUIR
- **Privacy**: GDPR Reg. UE 2016/679 + D.Lgs. 101/2018
- **Sub-processor**: Supabase Inc. (US) · Vercel Inc. (US) · Google LLC (US) — tutti coperti da Data Privacy Framework EU-US
- **Disclaimer**: l'app è uno strumento di simulazione. Non sostituisce la consulenza di un commercialista abilitato.

---

*Peppone Tek — Tutti i diritti riservati*
