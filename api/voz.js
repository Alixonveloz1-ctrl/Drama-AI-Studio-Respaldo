// ════════════════════════════════════════════════════════════════
// VOZ — Gemini TTS por Vertex AI (sección 14).
//
//   GET                       → { voces: [{ nombre, genero }] }
//     Las voces se le PIDEN a Google, no se escriben aquí: en el estudio de
//     anime la lista a mano ofrecía una voz que no existía. Las 30 voces de
//     Gemini TTS son las mismas personalidades que las voces Chirp 3 HD que
//     devuelve la API de voces de Google para es-US; de ahí salen el nombre
//     y el género de cada una.
//   POST { proyecto, clave, hablantes, lineas, registro } → { ruta, url, segundos }
//     Un tramo de escena, con uno o dos hablantes EN LA MISMA LLAMADA.
//
// La defensa contra la deriva de tono (14.2): una llamada por escena (o por
// tramo de hasta dos hablantes), nunca una línea sola; la MISMA instrucción
// de estilo en todas las llamadas del proyecto; loudnorm en el montaje.
// Gemini TTS no tiene control numérico de expresión: el registro (plana,
// normal o dramática) es una instrucción de texto. SIN modelo de respaldo.
// ════════════════════════════════════════════════════════════════
const puerta = require('./_lib/puerta');
const { cfg, urlVertex, firmarUrl } = require('./_lib/google');
const { ErrorEstudio, errorDeGoogle } = require('./_lib/errores');
const medios = require('./_lib/medios');
const { pcmAWav, duracionWav } = require('./_lib/audio');

const LIMITE_MS = 50000;

const REGISTROS = {
  plana: 'Read the lines flatly and evenly: no acting, no emotional colouring, no dramatic emphasis.',
  normal: 'Act the lines naturally, like a well-dubbed live-action drama: real emotion, grounded, never theatrical.',
  dramatica: 'Act the lines with full dramatic commitment, like the dub of a hit Asian short drama: clear emotional shifts, weighted pauses and real intensity at the peaks.',
};

// La instrucción es IDÉNTICA en todas las llamadas de un proyecto (solo
// cambia el registro elegido para todo el proyecto).
function instruccion(registro) {
  return `[${REGISTROS[registro] || REGISTROS.normal} Natural Latin American Spanish. Each speaker keeps exactly the same voice, age and timbre in every line. Lines that start with (inner thought) are that speaker's thoughts: softer and closer, never shouted; never read the words "inner thought" aloud.]`;
}

const VOZ = /^[A-Z][a-z]{2,20}$/;

async function listarVoces(proyecto, token) {
  let r;
  try {
    r = await fetch('https://texttospeech.googleapis.com/v1/voices?languageCode=es-US', {
      headers: { Authorization: `Bearer ${token}`, 'X-Goog-User-Project': proyecto }, signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new ErrorEstudio('No hubo conexión con Google para pedir la lista de voces: ' + e.message, { estado: 502, tipo: 'google' });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw errorDeGoogle('la lista de voces', r.status, d);
  const voces = new Map();
  for (const v of d.voices || []) {
    const m = String(v.name || '').match(/Chirp3-HD-([A-Za-z]+)$/);
    if (m && !voces.has(m[1])) voces.set(m[1], { nombre: m[1], genero: String(v.ssmlGender || '').toLowerCase() === 'female' ? 'mujer' : String(v.ssmlGender || '').toLowerCase() === 'male' ? 'hombre' : '' });
  }
  if (!voces.size) throw new ErrorEstudio('Google no devolvió ninguna voz de Gemini para español. Comprueba que la API de Text-to-Speech está activa (el instalador la activa).', { estado: 502, tipo: 'google' });
  return [...voces.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

module.exports = puerta({ metodos: ['GET', 'POST'] }, async (req, { google }) => {
  if (req.method === 'GET') {
    const { proyecto, token } = await google();
    return { voces: await listarVoces(proyecto, token) };
  }
  const limite = Date.now() + LIMITE_MS;
  const b = req.body || {};
  const destino = medios.rutaMedio(b.proyecto, b.clave, 'wav');
  const hablantes = Array.isArray(b.hablantes) ? b.hablantes : [];
  if (hablantes.length < 1 || hablantes.length > 2) throw new ErrorEstudio('Un tramo de voz lleva uno o dos hablantes.', { estado: 400, tipo: 'peticion' });
  if (hablantes.some(h => !VOZ.test(String(h?.voz || '')))) throw new ErrorEstudio('Falta la voz de algún personaje de este tramo.', { estado: 400, tipo: 'peticion' });
  const etiquetas = hablantes.map((_, i) => `Speaker${i + 1}`);
  const lineas = (Array.isArray(b.lineas) ? b.lineas : []).map(l => ({
    h: Math.max(0, Math.min(hablantes.length - 1, Number(l?.hablante) || 0)),
    texto: String(l?.texto || '').replace(/\s+/g, ' ').trim().slice(0, 600),
    pensamiento: l?.pensamiento === true,
  })).filter(l => l.texto);
  if (!lineas.length) throw new ErrorEstudio('Este tramo no tiene texto que decir.', { estado: 400, tipo: 'peticion' });
  if (lineas.reduce((n, l) => n + l.texto.length, 0) > 4000) throw new ErrorEstudio('Este tramo es demasiado largo para una sola llamada de voz.', { estado: 400, tipo: 'peticion' });

  const texto = l => `${l.pensamiento ? '(inner thought) ' : ''}${l.texto}`;
  const cuerpoTexto = hablantes.length === 1
    ? `${instruccion(b.registro)}\n\n${lineas.map(texto).join('\n')}`
    : `${instruccion(b.registro)}\n\nTTS the following conversation between ${etiquetas[0]} and ${etiquetas[1]}:\n${lineas.map(l => `${etiquetas[l.h]}: ${texto(l)}`).join('\n')}`;
  const speechConfig = hablantes.length === 1
    ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: hablantes[0].voz } } }
    : { multiSpeakerVoiceConfig: { speakerVoiceConfigs: hablantes.map((h, i) => ({ speaker: etiquetas[i], voiceConfig: { prebuiltVoiceConfig: { voiceName: h.voz } } })) } };

  const { cuenta, proyecto, token } = await google();
  // v1beta1: la versión con la que el estudio de anime llama a este modelo.
  const url = urlVertex(proyecto, cfg.ubicacionVoz, cfg.modeloVoz, 'generateContent').replace('/v1/projects/', '/v1beta1/projects/');
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': proyecto },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: cuerpoTexto }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig } }),
      signal: AbortSignal.timeout(Math.max(1000, limite - Date.now())),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new ErrorEstudio('Google tardó demasiado en leer este tramo y hubo que cortar. Vuelve a pulsar cuando quieras.', { estado: 504, tipo: 'tiempo' });
    throw new ErrorEstudio('No hubo conexión con Google para la voz: ' + e.message, { estado: 502, tipo: 'google' });
  }
  const crudo = await r.text();
  let d;
  try { d = JSON.parse(crudo); } catch { d = { error: { message: crudo.slice(0, 300) || `HTTP ${r.status}` } }; }
  if (!r.ok) throw errorDeGoogle(`la voz (${cfg.modeloVoz})`, r.status, d);
  const parte = d.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!parte) {
    const motivo = d.candidates?.[0]?.finishReason || d.promptFeedback?.blockReason || 'sin audio';
    const bloqueo = /SAFETY|BLOCK|PROHIBITED/i.test(motivo);
    throw new ErrorEstudio(bloqueo ? 'Google bloqueó la voz de este tramo con su filtro. Reintentar igual no sirve: hay que cambiar el texto.' : 'Google no devolvió audio para este tramo.', { estado: bloqueo ? 422 : 502, tipo: bloqueo ? 'bloqueo' : 'google', detalle: motivo });
  }
  const tipo = String(parte.inlineData.mimeType || '');
  const bruto = Buffer.from(parte.inlineData.data.replace(/\s/g, ''), 'base64');
  const frecuencia = Number(tipo.match(/rate=(\d+)/)?.[1]) || 24000;
  const wav = /wav/i.test(tipo) ? bruto : pcmAWav(bruto, { frecuencia });
  await medios.guardar(token, destino, wav, 'audio/wav');
  return { ruta: destino, url: firmarUrl(cuenta, cfg.bucket, destino), segundos: duracionWav(wav) };
});

module.exports.instruccion = instruccion;
