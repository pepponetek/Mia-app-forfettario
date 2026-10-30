# CLAUDE.md — ForfettarioApp · Guida Operativa per l'Agente

> **ISTRUZIONE PRIMARIA:** Leggi questo file PRIMA di qualsiasi altra azione in ogni sessione.
> Aggiornalo DOPO ogni sessione con nuovi bug, fix, decisioni e stato corrente.
> In caso di conflitto tra questo file e il PDR, il PDR vince sul dettaglio tecnico,
> ma questo file vince sulle regole operative e sui divieti.

---

## §1 — IDENTITÀ DEL PROGETTO

**ForfettarioApp** è un Digital Twin fiscale per contribuenti italiani in regime forfettario (L. 190/2014).
SPA vanilla HTML/CSS/JS — file unico `app.html`. Nessun framework, nessun build step.

| Proprietà | Valore |
|---|---|
| **Supabase Project ID** | `<SUPABASE_PROJECT_ID>` (valore reale nel gestore password, non nel repo) |
| **URL Produzione** | `tax-forfettario.vercel.app` |
| **GitHub Repo** | `<REPO_GITHUB>` (branch: main → auto-deploy Vercel) |
| **Admin email** | `<EMAIL_ADMIN>` (dato privato, non nel repo) |
| **Admin check** | `profiles.ruolo === 'admin'` — `is_admin` NON ESISTE |
| **PDR corrente** | v4.7 (Sessione O — post code review completo) |
| **app.html righe** | ~8561 (dopo pulizia codice morto Sessione O) |

---

## §2 — STACK TECNOLOGICO

```
app.html (Single File App)
├── CDN nel <head> con DEFER (obbligatorio — vedi §5)
│   ├── supabase.js     → @supabase/supabase-js@2
│   ├── chart.js        → chart.js@4.4.0
│   ├── jspdf.umd.min   → jspdf/2.5.1
│   └── pdf.min.js      → pdf.js/3.11.174
├── BOOT DETECTOR inline (prima dei CDN defer)
├── Codice app dentro DOMContentLoaded (obbligatorio — vedi §5)
├── window.* exports (63 funzioni — obbligatorio — vedi §5)
│
├── Supabase Backend
│   ├── auth          → JWT, OAuth Google, Email/password, RLS su tutto
│   ├── anni_fiscali  → storico calcoli per utente
│   ├── tax_rules     → coefficienti ATECO e aliquote (79 righe)
│   ├── tax_mapping_ade → mappatura righi LM per anno (rigo_contributi = LM34 ✓)
│   ├── pagamenti_effettuati → F24 pagati per codice tributo
│   ├── documenti_fiscali → PDF archiviati (storage_path nullable)
│   ├── admin_ai_alerts → log discrepanze Gemini
│   ├── config_ade_ai → config schema Gemini per anno
│   └── profiles      → dati utente (ruolo: 'admin'|'cliente')
│
├── Edge Functions (Supabase)
│   ├── calculate-tax  (v1, JWT=true, ACTIVE) — motore fiscale certificato
│   ├── parse-tax-pdf  (v21, JWT=false, ACTIVE) — AI parsing con Gemini
│   └── admin-delete-user (v2, JWT=true, ACTIVE)
│
└── Vercel (static deploy)
    ├── vercel.json → headers CSP + no cleanUrls (mai aggiungere cleanUrls)
    └── middleware.ts → SOLO COMMENTI, zero export, zero import
```

---

## §3 — PRINCIPIO ARCHITETTURALE FONDAMENTALE

```
AI (Gemini)     = ESTRATTORE  → estrae dati grezzi dal PDF
JS / Edge Fn    = CERTIFICATORE → fa la matematica fiscale
```

**Gemini NON calcola mai le tasse.** Restituisce JSON grezzo (righi LM, importi).
Il motore `calcola()` chiama SEMPRE la Edge Function `calculate-tax` lato server.
**Zero matematica fiscale in JavaScript lato client.**

---

## §4 — MATEMATICA FISCALE CERTIFICATA

> ⚠️ Queste formule sono verificate al centesimo sui PDF di un contribuente di test (dataset privato).
> NON deviare mai senza aggiornare questo file e il PDR.

```
lordo    = fatturato × coefficiente_ATECO
netto    = lordo − LM34 (contributi INPS deducibili)
imposta  = netto × aliquota (15% ordinario | 5% startup ≤5 anni)
saldo    = imposta − LM43 (eccedenza anno precedente)
```

### Dataset di regressione (privato)
- I valori di riferimento (fatturato, INPS LM34, imposta LM39, eccedenza LM43, saldo LM46) per tre anni di un contribuente di test sono **fuori dal repository**.
- Nomi, codice fiscale e importi reali non vanno inseriti in questo file né nel codice.
- Il controllo si esegue confrontando il calcolo dell'app con quel dataset.

### §4b — Parametri INPS 2026 (verificati su fonti ufficiali)
| Gestione | Parametro 2026 | Fonte |
|---|---|---|
| Gestione Separata liberi professionisti (senza altra cassa) | **26,07%** (25% IVS + 0,72% tutele + 0,35% ISCRO) | INPS circ. n. 8 del 3/2/2026 |
| Gestione Separata pensionati / già assicurati altrove | **24%** | INPS circ. n. 8/2026 |
| Artigiani: minimale | **18.808 €** | INPS circ. n. 14 del 9/2/2026 |
| Artigiani: contributo fisso (maternità inclusa) | **4.521,36 €** | INPS circ. n. 14/2026 |
| Artigiani: aliquota fino a 56.224 € / oltre | **24% / 25%** | INPS circ. n. 14/2026 |
| Commercianti: contributo fisso (maternità inclusa) | **4.611,64 €** | INPS circ. n. 14/2026 |
| Commercianti: aliquota fino a 56.224 € / oltre | **24,48% / 25,48%** | INPS circ. n. 14/2026 |
| Massimale artigiani/commercianti | **122.295 €** | INPS circ. n. 14/2026 |

**Regola:** ogni aliquota o minimale va verificato sulla circolare INPS dell'anno. Un valore senza fonte non si inserisce nel codice.
**Storico da verificare:** i valori 2024-2025 di artigiani e commercianti (minimale 17.504 €, fisso 4.208,40 €) sono superati e non sono stati ricontrollati.

### Dizionario Righi LM (CRITICO — non confondere mai)
| Rigo | Significato |
|---|---|
| **LM22** | Fatturato imponibile lordo |
| **LM34** | Contributi INPS deducibili ← **QUESTO è l'INPS** |
| **LM35** | Reddito netto (= lordo − LM34) ← **NON è l'INPS** |
| **LM39** | Imposta sostitutiva lorda |
| **LM43** | Eccedenza riportata anno precedente (credito) |
| **LM46** | Saldo imposta (positivo = debito, negativo = credito) |

### Codici Tributo F24 (sequenza CORRETTA)
| Codice | Quota | Scadenza |
|---|---|---|
| **1790** | I acconto 40% | Giugno/Luglio anno+1 |
| **1791** | II acconto 60% | Novembre anno+1 |
| **1792** | Saldo 100% | Giugno/Luglio anno+1 |
| **PXX / DPPI** | INPS Gestione Separata | Luglio + Novembre |

**FIX C:** Escludere pagamento se `anno_periodo === anno_pagamento`.
**ACCONTI_V5:** Regex `/^(179[012])$/` — NON aggiungere PXX/DPPI.

---

## §5 — ARCHITETTURA BOOT (CRITICA — NON TOCCARE)

Questa architettura risolve il blocco spinner infinito su mobile 4G (BUG-27).
Ogni elemento è **interdipendente** — rimuoverne uno rompe tutto.

### I 4 Elementi Obbligatori

**1. CDN con `defer` nel `<head>`**
```html
<script src="...supabase.js" defer></script>
<script src="...chart.js"    defer></script>
<script src="...jspdf.js"    defer></script>
<script src="...pdf.js"      defer></script>
```
`defer` = download parallelo, esecuzione dopo parsing HTML, prima di DOMContentLoaded.

**2. BOOT DETECTOR inline (prima dei CDN defer)**
```javascript
(function(){
  // controlla localStorage per chiavi sb-* con access_token
  if(hasToken) document.documentElement.classList.add('has-session');
})();
```
CSS associato: `html.has-session #loading-screen { display:flex }` /
`#loading-screen { display:none }` — primo accesso = form login immediato senza attendere CDN.

**3. Codice app in `DOMContentLoaded`**
```javascript
document.addEventListener('DOMContentLoaded', function() {
  'use strict';
  const sb = supabase.createClient(SURL, SKEY); // supabase garantito disponibile
  // ... tutto il codice app ...
});
```

**4. `window.*` exports — 64 funzioni (OBBLIGATORIO)**
Alla fine del callback DOMContentLoaded, TUTTE le funzioni chiamate da `onclick` (HTML statico E HTML generato dinamicamente da `innerHTML`) devono essere esposte:
```javascript
if (typeof showView      !== 'undefined') window.showView      = showView;
if (typeof togAyc        !== 'undefined') window.togAyc        = togAyc;
if (typeof trEdit        !== 'undefined') window.trEdit        = trEdit;
// ... tutte le 64 funzioni ...
if (typeof syncCascade   !== 'undefined') window.syncCascade   = syncCascade;
```
> ⚠️ Ogni nuova funzione aggiunta ad un `onclick` (sia nel HTML statico che in template literals/innerHTML nel JS) **va aggiunta al blocco window.***

### Livelli di Protezione Boot (ordine di scatto)
1. **BOOT DETECTOR** (< 1ms) → CSS mostra form login se no token
2. **FAILSAFE 8s non cancellabile** (primo statement di boot()) → forza showAuthScreen se nessuna UI visibile
3. **safetyTimer 7s** → copre sia !appStarted che appStarted + init lenta
4. **_initTimeout 12s** → dentro startApp(), sblocca se initAppData() non risponde

### Handler SIGNED_OUT — 3 Casi Obbligatori
```javascript
// CASO 1: app già visibile → logout volontario
if (appGiaVisibile) { resetApp(); }
// CASO 2: appStarted=true ma app non visibile → token rotation (IGNORARE)
else if (appStarted) { /* NON toccare nulla */ }
// CASO 3: appStarted=false → pre-login, pulisci e mostra form
else { clearLocalStorageTokens(); showAuthScreen(); }
```

### showAuthScreen() — DEVE fare entrambe le cose
```javascript
function showAuthScreen() {
  document.documentElement.classList.remove('has-session'); // ripristina CSS
  appStarted = false;                                        // permette re-login
  // mostra #auth-screen ...
}
```

---

## §6 — CSP E VERCEL.JSON (NON MODIFICARE SENZA LEGGERE QUESTO)

```json
"Content-Security-Policy": "
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
  worker-src https://cdnjs.cloudflare.com blob:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co
              https://generativelanguage.googleapis.com
              https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
  frame-ancestors 'none';"
```

**Note critiche:**
- `worker-src blob:` → obbligatorio per PDF.js Web Worker
- `connect-src cdn.jsdelivr.net cdnjs.cloudflare.com` → obbligatorio per source map Chart.js/jsPDF
- MAI aggiungere `cleanUrls: true` → genera 308 loop auth (BUG-18)

---

## §7 — REGOLE VIETATE (mai fare)

| ❌ | Regola |
|---|---|
| ❌ | MAI usare `profiles.is_admin` → non esiste. Usare `profiles.ruolo === 'admin'` |
| ❌ | MAI assumere `rigo_contributi = LM35` → è LM34 (LM35 = reddito netto) |
| ❌ | MAI fare matematica fiscale in `calcola()` lato client → chiamare `calculate-tax` EF |
| ❌ | MAI aggiungere funzioni a `onclick` senza aggiungerle al blocco `window.*` |
| ❌ | MAI rimuovere `defer` dai CDN nel `<head>` |
| ❌ | MAI rimuovere il wrapper `DOMContentLoaded` |
| ❌ | MAI rimuovere il BOOT DETECTOR nel `<head>` |
| ❌ | MAI rimuovere il FAILSAFE timer (è non cancellabile per design) |
| ❌ | MAI aggiungere `cleanUrls: true` in vercel.json |
| ❌ | MAI fare `replace('/app.html')` direttamente in `doLogin()` → usa guard `_navigating` + `goToApp()` |
| ❌ | MAI azzerare `_user`/`appStarted` nel handler SIGNED_OUT se `appStarted === true` |
| ❌ | MAI chiamare `localStorage.removeItem()` su token Supabase se `appStarted === true` |
| ❌ | MAI rimuovere `worker-src` dalla CSP |
| ❌ | MAI rimuovere `cdn.jsdelivr.net` / `cdnjs.cloudflare.com` da `connect-src` |
| ❌ | MAI usare PXX/DPPI in ACCONTI_V5 → regex `/^(179[012])$/` solo imposta |
| ❌ | MAI usare `export` in middleware.ts → Vercel lo interpreta come Edge Middleware |
| ❌ | MAI fare `apply_migration` senza prima eseguire `execute_sql SELECT` per verificare stato attuale |
| ❌ | MAI usare tabelle `radar_alerts` o `f24_precedenti` → non esistono. Usare `admin_ai_alerts` e `documenti_fiscali` |
| ❌ | MAI aggiungere HTML via `innerHTML` con `onclick` senza aggiornare `window.*` |
| ❌ | MAI usare aliquote o minimali INPS senza fonte nella tabella §4b |
| ❌ | MAI tenere parametri INPS diversi tra Edge Function `calculate-tax` e `app.html` |
| ❌ | MAI inserire dati utente in `innerHTML` senza `sanitizeHTML()` (anche il testo digitato in ATECO) |

---

## §8 — REGOLE OBBLIGATORIE (sempre fare)

| ✅ | Regola |
|---|---|
| ✅ | Leggere questo file PRIMA di ogni sessione |
| ✅ | Verificare con `execute_sql SELECT` prima di ipotizzare strutture DB |
| ✅ | Verificare ground truth §4 dopo ogni modifica al motore fiscale |
| ✅ | Ogni `await` in `initAppData()` deve avere il proprio `try/catch` isolato |
| ✅ | `apply_migration` per DDL — `execute_sql` solo per SELECT/UPDATE dati |
| ✅ | Usare `.html` esplicito in tutti i `redirectTo` (doGoogleLogin, doForgotPw) |
| ✅ | Aggiungere `guard admin` come primo statement in ogni funzione admin (saveTaxRules, saveMappingAdE, ecc.) |
| ✅ | Sanitizzare con `sanitizeHTML()` qualsiasi output Gemini o dato DB che va in `innerHTML` |
| ✅ | Aggiornare questo file e generare PDR aggiornato alla fine di ogni sessione |
| ✅ | Backtest sul dataset di regressione privato prima di modificare il parser o il motore fiscale |

---

## §9 — PROCESSO OPERATIVO PER SESSIONE

```
INIZIO SESSIONE:
1. Leggi CLAUDE.md (questo file)
2. Leggi PDR corrente se la sessione tocca architettura/DB/parser
3. Verifica stato DB con execute_sql se necessario

DURANTE LA SESSIONE:
4. Ogni fix: verifica → applica → controlla (mai applicare senza verificare prima)
5. Ogni nuova funzione onclick: aggiornare window.*
6. Ogni nuovo innerHTML con onclick: aggiornare window.*
7. Ogni modifica CSP/vercel.json: verificare tutti i domini necessari

FINE SESSIONE:
8. Aggiorna §10 (Stato corrente) in questo file
9. Aggiorna §11 (Bug log) se ci sono nuovi bug/fix
10. Genera PDR aggiornato (.docx)
11. Consegna app.html + CLAUDE.md aggiornato + PDR nuovo
```

---

## §10 — STATO CORRENTE

```
Sessione:          P-bis (login fix + sicurezza + allineamento INPS 2026)
Data:              30 Ottobre 2026
PDR versione:      v4.7 (da aggiornare alla sessione P-bis)
app.html righe:    ~8600 (con fix login P3/P4/P5, sanitizzazione ATECO, libreria Supabase fissata a 2.117.3)

### Modifiche Sessione P-bis
| ID | Categoria | Fix |
|---|---|---|
| P-01 | Critico | Login bloccato: fix P3 (await sequenziali), P4 (12000 ms), P5 (7000 ms) pubblicati su main |
| P-02 | Critico | Edge Function `calculate-tax` v2: GS 26,72% → **26,07%**; artigiani/commercianti 2026 con minimale 18.808 € e fasce 24/25% e 24,48/25,48%; massimale 122.295 €; acconti al centesimo |
| P-03 | Warning | `app.html`: parametri INPS artigiani/commercianti allineati al 2026 (fisso e minimale) |
| P-04 | Warning | Libreria Supabase fissata a 2.117.3 (era `@2`) |
| P-05 | Warning | Sanificazione con `sanitizeHTML()` dei dati ATECO in `innerHTML` |
| P-06 | Warning | `rel="noopener"` sul link PDF |
| P-07 | Sicurezza | Password utente esposta in una foto: da cambiare. Protezione password compromesse da attivare in Supabase Auth |

### Stato del lavoro aperto
- **Calcolo fiscale nel browser (da completare):** `applicaDatiPDFSilent`, `syncFutureYears`, `confAggiornaBozza`, `wizPreview`, `wizNext`, `convalidaLocale` replicano ancora le formule. In `app.html` la seconda fascia di artigiani/commercianti (oltre 56.224 €) non è ancora modellata in questi punti. Va sostituito con chiamate a `calculate-tax` e testato sul ground truth §4.
- **Ground truth:** non ancora riverificato dopo la v2 della Edge Function.
```

### Fix applicati in Sessione O (Code Review)

| ID | Categoria | Fix |
|---|---|---|
| C1 | Critico | `window.trEdit = trEdit` aggiunto al blocco window.* |
| C2 | Critico | `sanitizeHTML()` su `convalida.messaggio` e `mapping.rigo_*` in `aggiornaAuditBanner()` |
| C3 | Critico | `try/catch` su `insert(logs)` in `radarConfermaModifiche()` |
| C4 | Critico | Guard `ruolo !== 'admin'` in `saveTaxRules()` e `saveMappingAdE()` |
| C5 | Critico | Commento codici tributo corretto (era invertito in `classificaCausale()`) |
| W1 | Warning | `catch` su `delete()` in `applicaDatiPDFSilent()` prima dell'insert |
| W2 | Warning | `getSession()` estratto in variabile con `try/catch` in `radarAnalizzaCircolare()` |
| W3 | Warning | Label "INPS dedotta (LM35)" → **LM34** nel modal conferma PDF |
| W4 | Warning | Guard `\|\|0` su `d.aliquota` e `d.coefficiente` in template `renderArchivio()` |
| I1 | Info | `trovaBloccoSezione()` rimossa (codice morto — mai chiamata) |
| I2 | Info | `syncCascade` esposta su `window.*` |
| I3 | Info | `buildL2Prompt()` e `cleanTaxValue()` rimosse con tutti i riferimenti |

### Funzioni esposte su window.* (64 totali)

**Batch 1 — HTML statico (50):**
annullaApplicaDatiPDF, calcola, closeModal, closeModalMappingAdE, confAggiornaBozza, confCambiaStato, confDel, confDelDoc, confermaAiResult, confermaApplicaDatiPDF, confirmSentinelUpdate, doForgotPw, doGoogleLogin, doLogin, doLogout, doRegister, doResetPassword, exportCSV, exportJSON, exportPDF, filterAdmin, filterDocumentiView, g, generaF24Facsimile, importJSON, loadRadarAlerts, loadTaxRules, lookupAteco, onAnnoChange, onArchPdfSelected, onGruppoChange, onInpsTipoChange, openModal, openModalMappingAdE, printAnno, radarAnalizzaCircolare, renderConfronto, salvaAnno, saveMappingAdE, saveTaxRules, showView, switchAdmTab, switchTab, togglePrevisionale, togglePw, wizAbort, wizNext, wizParsePDF, wizPreview, wizSkipStep

**Batch 2 — HTML dinamico/template (13):**
apriAggiornaBozza, archAnalizzaPDF, cambiaStato, downloadDoc, editMappingAdE, openArch, radarConfermaModifiche, radarRisolviAlert, resetInpsVersata, ricaricaDocumento, richiediDel, richiediDelDoc, togAyc

**Batch 3 — Sessione O (1):**
trEdit *(onchange nella tabella tax_rules admin)*

**Aggiuntiva (1):**
syncCascade *(API pubblica per aggiornamento manuale cascade)*

---

## §11 — BUG LOG (sintesi operativa)

Per la storia completa vedi PDR. Qui solo i pattern da non ripetere.

### Bug registrati in Sessione P-bis
- **Login bloccato con spinner infinito (P-01):** `initAppData()` era passato a `Promise.allSettled` fire-and-forget (P3) e i timer erano troppo corti (P4, P5). Soluzione: await sequenziali e timer 12000/7000 ms.
- **Calcolo INPS disallineato (P-02, P-03):** Edge Function e `app.html` usavano valori diversi (26,72% vs 26,07%; artigiani/commercianti 2024-2025). Soluzione: valori 2026 da circolari INPS in entrambi.
- **Edge Function con acconti arrotondati all'euro (P-02):** non compatibile con il ground truth al centesimo. Corretto.

### Pattern di Bug Ricorrenti

**🔴 SCOPE:** Funzione definita in DOMContentLoaded non visibile da onclick inline
→ Soluzione: aggiungere sempre al blocco `window.*` — sia HTML statico che innerHTML dinamico

**🔴 CDN BLOCCANTI:** Script CDN senza `defer` bloccano tutto JS su mobile 4G
→ Soluzione: sempre `defer` sui CDN nel `<head>`

**🔴 TOKEN ROTATION:** Supabase v2 spara SIGNED_OUT durante init → non pulire localStorage
→ Soluzione: CASO 2 nel handler (ignora se appStarted=true)

**🟡 XSS:** Output Gemini/DB in innerHTML senza sanitize
→ Soluzione: sempre `sanitizeHTML()` su dati non controllati in innerHTML

**🟡 GUARD ADMIN:** Funzioni admin protette solo da RLS, non da JS
→ Soluzione: guard `_profile?.ruolo !== 'admin'` come primo statement

**🟡 NaN%:** `d.aliquota * 100` su record con aliquota null
→ Soluzione: sempre `(d.aliquota||0)*100`

**🔵 CODICE MORTO:** Funzioni definite ma mai chiamate (trovaBloccoSezione, buildL2Prompt, cleanTaxValue)
→ Soluzione: rimuovere al primo code review

---

## §12 — TEST DI SANITÀ PRE-DEPLOY

Eseguire prima di ogni push su main:

```
□ Primo accesso (no token): form login visibile in < 1 secondo senza attendere CDN
□ Mobile 4G simulata: form login in < 1 secondo (non spinner infinito)
□ Click sidebar (showView): nessun ReferenceError in console DevTools
□ Apertura scheda archivio (togAyc): nessun ReferenceError
□ Click "Elimina documento" (richiediDelDoc): nessun ReferenceError
□ Click tabella tax_rules admin (trEdit): nessun ReferenceError
□ Click "Analizza PDF" (archAnalizzaPDF): nessun ReferenceError
□ Console: nessun errore CSP connect-src source map
□ Console: nessun errore worker-src
□ Login manuale: app si apre correttamente
□ Logout: redirect a index.html (non loop a /app.html)
□ Token rotation: console mostra "[boot] SIGNED_OUT durante init — ignorato"
□ DB check: SELECT anno, rigo_contributi FROM tax_mapping_ade → tutti LM34
□ Ground truth: confronto con il dataset di regressione privato (vedi sezione dataset)
```

---

## §13 — ROADMAP APERTA

| ID | Attività | Priorità |
|---|---|---|
| H-01 | Rate Limiting Gemini (Edge Function parse-tax-pdf) | Alta |
| H-03 | ATECO 2025 mapping aggiornato in tax_rules | Alta |
| H-04 | Concordato Preventivo Biennale — UI LM32/LM33 | Media |
| H-05 | Dashboard multi-anno completa + export | Media |
| H-06 | Notifiche scadenze push (30/15/7 giorni) | Media |
| H-08 | Supporto multi-attività (più codici ATECO) | Bassa |
| H-09 | PWA (manifest.json + service worker offline) | Bassa |
| H-11 | Spostare il calcolo fiscale di `app.html` in `calculate-tax` (6 funzioni, vedi Sessione P-bis) | **Alta** |
| H-12 | Modellare la seconda fascia artigiani/commercianti nel browser fino al completamento di H-11 | Alta |
| H-13 | Rimuovere la barra di debug e verificare la sanificazione di tutti gli `innerHTML` | Media |

**PDR da generare:** v4.7 con tutti i fix della Sessione O documentati.

---

*ForfettarioApp · CLAUDE.md aggiornato: 30 Ottobre 2026 · Sessione P-bis*
