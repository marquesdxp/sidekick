/*
 * Sidekick - Cloudflare Worker que reenvia mensajes a la WhatsApp Cloud API.
 *
 * Cada usuario despliega SU PROPIO Worker con SUS PROPIOS secretos. En este
 * repositorio no hay ninguna credencial, ni ninguna URL de despliegue: ese es
 * el motivo de que wrangler.toml y .dev.vars esten en .gitignore y aqui solo
 * viaje wrangler.toml.example.
 *
 * Secretos esperados (wrangler secret put ...):
 *   SIDEKICK_TOKEN  token compartido que el panel manda en x-sidekick-token
 *   META_TOKEN        token de acceso permanente de la app de Meta
 *   WABA_PHONE_ID     ID del numero de telefono emisor de WhatsApp Business
 */

const GRAPH_VERSION = 'v21.0';
const MAX_TEXT = 1000;

const CORS = {
  // El panel CEP corre sobre file://, asi que su Origin llega como "null" y no
  // se puede acotar por dominio. Lo que autoriza de verdad es el token.
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-sidekick-token',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

/** Comparacion en tiempo constante: evita filtrar el token byte a byte. */
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') { return false; }
  if (given.length !== expected.length) { return false; }
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') { return new Response(null, { status: 204, headers: CORS }); }
    if (request.method !== 'POST') { return json(405, { error: 'Solo POST.' }); }

    for (const name of ['SIDEKICK_TOKEN', 'META_TOKEN', 'WABA_PHONE_ID']) {
      if (!env[name]) { return json(500, { error: `Falta el secreto ${name} en el Worker.` }); }
    }
    if (!tokenMatches(request.headers.get('x-sidekick-token'), env.SIDEKICK_TOKEN)) {
      return json(401, { error: 'Token invalido.' });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { error: 'El cuerpo no es JSON valido.' });
    }

    // Sin esto el Worker seria un relay abierto de WhatsApp para cualquiera que
    // se hiciera con el token: numero acotado y texto acotado, siempre.
    const to = String(payload.to ?? '').replace(/\D/g, '');
    if (to.length < 8 || to.length > 15) {
      return json(400, { error: 'El campo "to" debe ser un numero E.164 de 8 a 15 digitos.' });
    }
    const text = String(payload.text ?? '').slice(0, MAX_TEXT);
    if (!text.trim()) { return json(400, { error: 'El campo "text" esta vacio.' }); }

    // Una lista blanca opcional para que ni con el token filtrado se pueda
    // escribir a numeros que no sean los tuyos. Se define en wrangler.toml.
    const allowed = String(env.ALLOWED_NUMBERS ?? '').replace(/\s/g, '');
    if (allowed && !allowed.split(',').includes(to)) {
      return json(403, { error: 'Numero no permitido por ALLOWED_NUMBERS.' });
    }

    const upstream = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${env.WABA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.META_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      },
    );

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      // El error de Meta se devuelve tal cual (no lleva secretos) para que el
      // panel pueda mostrar cosas como "fuera de la ventana de 24 h".
      return json(upstream.status, { error: 'La API de Meta rechazo el mensaje.', meta: result });
    }
    return json(200, { ok: true, id: result?.messages?.[0]?.id ?? null });
  },
};
