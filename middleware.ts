/**
 * middleware.ts — Vercel Edge Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Protegge tutti i path sotto /api/* e /functions/* da accessi non autenticati.
 * Verifica il JWT Supabase prima che la richiesta raggiunga le funzioni.
 *
 * Come funziona:
 *  1. Ogni request arriva qui prima di qualsiasi funzione serverless
 *  2. Cerchiamo il JWT nell'header Authorization oppure nel cookie "sb-access-token"
 *  3. Decodichiamo il payload (verifica firma tramite SUPABASE_JWT_SECRET)
 *  4. Se il token è assente, malformato o scaduto → risposta 401 JSON
 *  5. Se il token è valido → passiamo alla funzione target con un header
 *     x-user-id aggiunto per comodità del handler
 *
 * Deploy:
 *  - Questo file deve stare nella ROOT del progetto (stesso livello di package.json)
 *  - Su Vercel impostare la variabile d'ambiente SUPABASE_JWT_SECRET
 *    (la trovi in Supabase → Project Settings → API → JWT Secret)
 *  - NON richieede dipendenze aggiuntive: usa solo Web Crypto API nativa
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Path da proteggere ────────────────────────────────────────────────────────
// Solo le route API/funzioni richiedono JWT. L'app HTML pubblica no.
const PROTECTED_PREFIXES = ['/api/', '/functions/'];

// ── Helper: estrai JWT da header o cookie ────────────────────────────────────
function extractJwt(req: NextRequest): string | null {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);

  // 2) Cookie Supabase (nome variabile per versione client)
  const cookieNames = ['sb-access-token', 'supabase-auth-token'];
  for (const name of cookieNames) {
    const val = req.cookies.get(name)?.value;
    if (val) {
      // Il cookie potrebbe contenere JSON array ["token", "refresh"]
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed[0]) return parsed[0];
      } catch {
        return val; // è già il token grezzo
      }
    }
  }
  return null;
}

// ── Helper: decodifica JWT senza librerie esterne ────────────────────────────
// Nota: verifica solo la firma HMAC-SHA256 (tipo "HS256", usato da Supabase).
// Non verifica "iss" o "aud" — sufficienti per questo use case.
async function verifyJwt(token: string, secret: string): Promise<{ sub: string; exp: number } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;

    // Verifica firma
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    const data     = enc.encode(`${headerB64}.${payloadB64}`);
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!valid) return null;

    // Decodifica payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    return { sub: payload.sub, exp: payload.exp };
  } catch {
    return null;
  }
}

// ── Handler principale ────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Salta path non protetti
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Estrai JWT
  const token = extractJwt(req);
  if (!token) {
    return NextResponse.json(
      { error: 'Non autenticato. Token JWT mancante.' },
      { status: 401 }
    );
  }

  // Verifica firma e scadenza
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('[middleware] SUPABASE_JWT_SECRET non configurato!');
    return NextResponse.json({ error: 'Configurazione server incompleta.' }, { status: 500 });
  }

  const payload = await verifyJwt(token, jwtSecret);
  if (!payload) {
    return NextResponse.json(
      { error: 'Token JWT non valido o malformato.' },
      { status: 401 }
    );
  }

  // Verifica scadenza
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return NextResponse.json(
      { error: 'Token JWT scaduto. Effettua nuovamente il login.' },
      { status: 401 }
    );
  }

  // Token valido: aggiungi user_id come header per i handler downstream
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.sub);
  return response;
}

// ── Configurazione Vercel: quali path attivano il middleware ──────────────────
export const config = {
  matcher: ['/api/:path*', '/functions/:path*'],
};
