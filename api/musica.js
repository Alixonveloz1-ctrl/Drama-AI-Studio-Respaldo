// ════════════════════════════════════════════════════════════════
// MÚSICA — Lyria por Vertex AI (sección 14.4).
//
//   POST { proyecto, clave, brief } → { ruta, url, segundos }
//
//  · Una pista por acto; el brief lo escribe el director a partir de la
//    identidad musical de la biblia y de lo que pasa en ese acto.
//  · Lyria SOLO acepta inglés: con texto en español rechaza la petición
//    entera («Unsupported language detected»). Se comprueba antes.
//  · Devuelve un clip instrumental de unos 30 s; el montaje lo repite con
//    fundidos bajo la duración del acto. Va directo al bucket (un WAV de 30 s
//    pesa más que el límite de respuesta de Vercel).
// ════════════════════════════════════════════════════════════════
const puerta = require('./_lib/puerta');
const { cfg, urlVertex, firmarUrl } = require('./_lib/google');
const { ErrorEstudio, errorDeGoogle } = require('./_lib/errores');
const medios = require('./_lib/medios');
const { duracionWav } = require('./_lib/audio');

const LIMITE_MS = 50000;
// Sin voces: la música nunca compite con el diálogo.
const NEGATIVO = 'vocals, singing, voice, lyrics, spoken word, rap, choir';

module.exports = puerta({ metodos: ['POST'] }, async (req, { google }) => {
  const limite = Date.now() + LIMITE_MS;
  const b = req.body || {};
  const destino = medios.rutaMedio(b.proyecto, b.clave, 'wav');
  const brief = String(b.brief || '').replace(/\s+/g, ' ').trim();
  if (brief.length < 20) throw new ErrorEstudio('Falta la descripción de la música.', { estado: 400, tipo: 'peticion' });
  if (/[áéíóúñ¿¡]/i.test(brief)) throw new ErrorEstudio('La descripción de la música está en español y Lyria solo acepta inglés. Vuelve a pedir la música para que el director la escriba en inglés.', { estado: 400, tipo: 'peticion' });

  const { cuenta, proyecto, token } = await google();
  let r;
  try {
    r = await fetch(urlVertex(proyecto, cfg.ubicacionMusica, cfg.modeloMusica, 'predict'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': proyecto },
      body: JSON.stringify({ instances: [{ prompt: brief.slice(0, 2000), negative_prompt: NEGATIVO }], parameters: {} }),
      signal: AbortSignal.timeout(Math.max(1000, limite - Date.now())),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new ErrorEstudio('Lyria tardó demasiado en componer esta pista y hubo que cortar. Vuelve a pulsar cuando quieras.', { estado: 504, tipo: 'tiempo' });
    throw new ErrorEstudio('No hubo conexión con Google para la música: ' + e.message, { estado: 502, tipo: 'google' });
  }
  const crudo = await r.text();
  let d;
  try { d = JSON.parse(crudo); } catch { d = { error: { message: crudo.slice(0, 300) || `HTTP ${r.status}` } }; }
  if (!r.ok) throw errorDeGoogle(`la música (${cfg.modeloMusica})`, r.status, d);
  // El audio llega en uno de estos campos según la versión del modelo.
  const p = (d.predictions || []).find(x => x?.bytesBase64Encoded || x?.audioContent || x?.audio);
  if (!p) throw new ErrorEstudio('Lyria no devolvió audio.', { estado: 502, tipo: 'google', detalle: JSON.stringify(d).slice(0, 300) });
  const wav = Buffer.from(String(p.bytesBase64Encoded || p.audioContent || p.audio).replace(/\s/g, ''), 'base64');
  await medios.guardar(token, destino, wav, 'audio/wav');
  return { ruta: destino, url: firmarUrl(cuenta, cfg.bucket, destino), segundos: duracionWav(wav) };
});
