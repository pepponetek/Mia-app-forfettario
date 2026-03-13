/**
 * middleware.ts — Vercel Edge Middleware
 *
 * NESSUNA dipendenza Next.js (next/server era unsupported su deployment statico).
 * Usa solo Web Crypto API nativa dell'Edge Runtime Vercel.
 *
 * Ruolo: verifica JWT Supabase per le route /api/* (se presenti in futuro).
 * Per questa SPA statica, tutte le chiamate API vanno direttamente alle
 * Supabase Edge Functions (JWT verificato lato Supabase con RLS).
 * Il matcher vuoto rende il middleware un no-op sicuro — il build Vercel passa.
 */

export const config = {
  // Nessuna route da proteggere su Vercel per questa SPA statica.
  // Le Edge Functions Supabase (calculate-tax, parse-tax-pdf) hanno
  // il proprio JWT check — non passano da qui.
  matcher: [],
};

export default async function middleware(
  _request: Request
): Promise<Response | undefined> {
  // No-op: restituisce undefined → Vercel serve la risorsa normalmente.
  return undefined;
}

/*
 * ── PROTEZIONE JWT (da attivare se si aggiungono route /api/* su Vercel) ──
 *
 * Per abilitare:
 *   1. Impostare config.matcher = ['/api/:path*']
 *   2. Aggiungere SUPABASE_JWT_SECRET nelle Environment Variables di Vercel
 *   3. Decommentare verifyJWT() e il corpo alternativo di middleware()
 *
async function verifyJWT(token: string, secret: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return false;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const b64url = (s: string) =>
      s.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        s.length + ((4 - (s.length % 4)) % 4), '='
      );
    const sig = Uint8Array.from(atob(b64url(sigB64)), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) return false;
    const payload = JSON.parse(atob(b64url(payloadB64)));
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function middleware(
  request: Request
): Promise<Response | undefined> {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const secret = (process.env.SUPABASE_JWT_SECRET as string) ?? '';
  if (!token || !secret || !(await verifyJWT(token, secret))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return undefined;
}
*/
