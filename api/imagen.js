// ════════════════════════════════════════════════════════════════
// IMAGEN — genera una imagen con Gemini (Nano Banana) y la guarda directamente
// en el bucket. Al navegador solo vuelve la ruta y una URL firmada: nada de
// imágenes de varios megas viajando por Safari.
//
// Cómo se arma el mensaje (orden deliberado, del estudio de anime):
//   1. El CONTRATO DE ESTILO semirrealista (sección 9.1), literal y SIEMPRE
//      primero: enmarca todo lo demás. Nunca se sustituye por otra cosa.
//   2. La referencia de CONTINUIDAD (el plano anterior) con su contrato 10.4.
//   3. Cada FICHA DE PERSONAJE seguida de su contrato 10.2. Sin esa línea el
//      modelo copia el encuadre de la ficha en vez de la identidad.
//   4. La referencia del ESCENARIO, si existe.
//   5. Las reglas fijas, la dirección de aspecto del proyecto (casting
//      atractivo, género y CADA subgénero elegido, ecchi) y la escena.
// Las referencias se leen del bucket aquí mismo. Si una ficha de personaje no
// se puede adjuntar, NO se genera: ninguna imagen sale en silencio sin su
// identidad (sección 12).
//
// Un bloqueo de seguridad no se reintenta: se devuelve como bloqueo. Una cuota
// (429) sí rota de región si el modelo es regional; los modelos Gemini 3.x
// solo existen en "global" y allí no hay a dónde rotar.
// ════════════════════════════════════════════════════════════════
const puerta = require('./_lib/puerta');
const { cfg, urlVertex, ubicacionImagen, firmarUrl, MODELOS_IMAGEN } = require('./_lib/google');
const { ErrorEstudio, clasificar } = require('./_lib/errores');
const medios = require('./_lib/medios');
const { limpiarPrompt } = require('./_lib/saneado');

const LIMITE_MS = 52000;
const MAX_REFERENCIAS_BYTES = 14 * 1024 * 1024;

const ESTILO = `ART STYLE (non-negotiable, applies to the ENTIRE image and every character in it): CINEMATIC SEMI-REALISTIC LIVE-ACTION DRAMA FRAME, in the visual language of a high-budget Asian historical or survival drama. Photographic skin with real texture, pores and subsurface detail. Volumetric cinematic lighting with motivated sources: golden-hour sun, cold morning light, firelight, shafts through gaps. Real fabric weave and material response — worn linen, wet cotton, oiled leather, weathered wood, rusted metal. Shallow depth of field with natural lens falloff and gentle bokeh. Colour grading of a graded film: rich but controlled contrast, filmic highlight rolloff, no crushed blacks. Faces are adult, grounded and anatomically correct, with human-sized eyes and readable micro-expression. Full-frame cinematic composition with real perspective and atmospheric depth. STRICTLY FORBIDDEN: 2D anime, cel shading, hand-drawn linework, ink outlines, flat graphic shadow shapes, manga styling, cartoon proportions, chibi, oversized eyes, Disney/Pixar stylisation, illustration, painterly brushwork, plastic or waxy skin, videogame cutscene plastic shading, over-sharpened AI portrait look. The result must look like a frame grabbed from a professionally shot and graded drama series.`;

const contratoPersonaje = nombre => `CHARACTER REFERENCE above: this is ${nombre}. Use it ONLY as the identity anchor: same face shape, facial proportions, hair colour/style, eye colour, adult body proportions and distinctive traits. DO NOT copy the reference pose, framing, neutral background or reference-sheet composition. WARDROBE IS CONTROLLED BY THE CURRENT SCENE TEXT: if this shot specifies a different outfit, use the shot's outfit while preserving identity. Redraw ${nombre} in the ART STYLE stated at the top of this message at the body pose, camera angle and scale required by this scene, grounded in the environment and sharing its perspective and light. Never turn the reference into a collage or duplicate the person. Do not mix up characters.`;

const CONTRATO_CONTINUIDAD = `This reference is the immediately preceding physical state, not a loose mood board. Keep the SAME location identity (architecture, palette, time of day), lighting, character identity, clothing, hairstyle, injuries and object state. Preserve spatial continuity: a character remains at the same place until the CURRENT scene text moves them; an open door stays open; an object already held stays held until the text changes it. A camera cut changes framing, NOT reality. A character may be off-camera only when the CURRENT prompt deliberately frames something else — do not erase, teleport or relocate them just because the angle changed. This new image is a LATER moment, so actions may advance ONLY as described by the current scene text. If the current text explicitly changes state (door opens, character falls, object is picked up), the current text wins.`;

const CONTRATO_ESCENARIO = 'LOCATION REFERENCE above: this is the place where the scene happens. Keep its architecture, materials, palette and layout. Do not copy its framing; compose the shot the scene text asks for.';

function reglas(nombres, formato, ecchi, direccion) {
  return `${nombres.length ? `Character references provided: ${nombres.join(', ')}.\n\n` : ''}MANDATORY RULES:
1. ABSOLUTELY NO TEXT: no letters, words, numbers, watermarks, captions, subtitles, readable signage, logos or signatures.
2. Show EVERY character named in the scene and nobody else beyond those mentioned.
3. Each character appears EXACTLY ONCE: never duplicate a person in the frame.${nombres.length ? '\n4. Match EACH character to THEIR reference image. Do not swap faces.' : ''}
5. Draw each character's hair exactly as described: never lengthen, shorten or restyle it.
6. Faces clear and anatomically correct. No extra limbs, no extra fingers, no melted features.
7. Format: ${formato === '16:9' ? '16:9 horizontal widescreen' : '9:16 vertical'} frame.
8. People integrated into the environment at true real-world scale, feet grounded, sharing the perspective and light of the place.
9. LITERAL STAGING ONLY: a figure of speech about a feeling becomes an expression or a posture, never a special effect (no glowing eyes, no energy, no floating symbols). Real supernatural events stated as physically happening are allowed.${ecchi ? `
10. ADULT ECCHI PROJECT: every character is an ADULT (18+) and clearly looks adult. Adult women keep their alluring figure and their figure-flattering wardrobe in every shot — it is part of their design. When the current scene describes a suggestive beat, render it confidently through pose, framing, wardrobe and expression; in grief or combat beats the emotion of the scene leads and no extra posing is added. Never nudity, never intimate parts.` : ''}${direccion ? `

PROJECT LOOK (chosen by the owner — apply all of it):
${direccion}` : ''}`;
}

const sinAcceso = m => /was not found or your project does not have access|publisher model .*not found/i.test(String(m || ''));

async function pedirAVertex(url, partes, proyecto, token, formato, limite) {
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': proyecto },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: formato === '16:9' ? '16:9' : '9:16' } },
      }),
      signal: AbortSignal.timeout(Math.max(1000, limite - Date.now())),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return { tiempo: true };
    throw new ErrorEstudio('No hubo conexión con Google para la imagen: ' + e.message, { estado: 502, tipo: 'google' });
  }
  const crudo = await r.text();
  let d;
  try { d = JSON.parse(crudo); } catch { d = { error: { message: crudo.slice(0, 300) || `HTTP ${r.status}` } }; }
  return { ok: r.ok, estado: r.status, datos: d };
}

// Interpreta la respuesta: imagen, bloqueo, cuota u otro error.
function leerRespuesta(res, modelo) {
  const d = res.datos || {};
  const mensaje = d.error?.message || '';
  if (!res.ok) {
    const detalle = `${res.estado} — ${mensaje}`;
    if (sinAcceso(mensaje)) return { error: new ErrorEstudio(`Tu proyecto no tiene acceso al modelo de imagen ${modelo}.`, { estado: 502, tipo: 'google', detalle }) };
    const tipo = clasificar(`${detalle} ${d.error?.status || ''}`);
    if (tipo === 'bloqueo') return { error: new ErrorEstudio('Google bloqueó esta imagen con su filtro de seguridad. Reintentar igual no sirve: cambia el texto del plano.', { estado: 422, tipo, detalle }) };
    if (tipo === 'cuota' || res.estado === 429) return { cuota: true, error: new ErrorEstudio('Google pide esperar: se alcanzó el límite de imágenes por minuto de tu cuenta.', { estado: 429, tipo: 'cuota', detalle }) };
    return { rotable: res.estado === 503, error: new ErrorEstudio(`Google no generó la imagen (código ${res.estado}).`, { estado: 502, tipo: 'google', detalle }) };
  }
  const candidato = d.candidates?.[0];
  const parte = candidato?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (parte) return { imagen: Buffer.from(parte.inlineData.data.replace(/\s/g, ''), 'base64'), tipo: parte.inlineData.mimeType };
  // Una respuesta SIN imagen es un rechazo, no falta de capacidad. Tratarla
  // como cuota hacía que se reintentara ocho veces con esperas de minutos.
  const motivo = candidato?.finishReason || d.promptFeedback?.blockReason || 'sin imagen';
  const texto = candidato?.content?.parts?.find(p => p.text)?.text;
  return { error: new ErrorEstudio('Google no quiso dibujar esta imagen (la bloqueó o respondió solo con texto). Reintentar igual no sirve: cambia el texto del plano.', { estado: 422, tipo: 'bloqueo', detalle: `blocked ${motivo}${texto ? ' — ' + texto.slice(0, 160) : ''}` }) };
}

module.exports = puerta({ metodos: ['POST'] }, async (req, { google }) => {
  const limite = Date.now() + LIMITE_MS;
  const b = req.body || {};
  const { proyecto: id, clave, prompt } = b;
  const formato = b.formato === '16:9' ? '16:9' : '9:16';
  const modelo = MODELOS_IMAGEN.includes(b.modelo) ? b.modelo : cfg.modeloImagen;
  if (typeof prompt !== 'string' || prompt.trim().length < 10) throw new ErrorEstudio('Falta el texto de la imagen.', { estado: 400, tipo: 'peticion' });
  const destino = medios.rutaMedio(id, clave, 'png');
  const personajes = (Array.isArray(b.personajes) ? b.personajes : []).slice(0, 4);
  const { cuenta, proyecto, token } = await google();

  // Referencias desde el bucket. Una ficha que falta o no se lee detiene todo.
  const avisos = [];
  let presupuesto = MAX_REFERENCIAS_BYTES;
  const adjuntar = async (ruta, quePara) => {
    const { bytes, tipo } = await medios.leer(token, medios.exigirDelProyecto(id, ruta), quePara);
    presupuesto -= bytes.length;
    return { inlineData: { mimeType: /^image\//.test(tipo) ? tipo : 'image/png', data: bytes.toString('base64') } };
  };
  const partes = [{ text: ESTILO }];
  if (b.base) {
    // Edición (variante de un personaje): se parte de la imagen de la madre.
    partes.push(await adjuntar(b.base, 'la imagen del personaje original'));
    partes.push({ text: `BASE IMAGE above: this is ${String(b.nombreBase || 'the character')}. EDIT it: ${limpiarPrompt(prompt)}. Keep the SAME person — same face, facial proportions, eye colour, body proportions and distinctive traits — and the same clean reference-sheet composition (one person, full body, neutral background). Change ONLY what the edit asks.` });
  } else {
    if (b.continuidad) {
      partes.push(await adjuntar(b.continuidad, 'la imagen del plano anterior'));
      partes.push({ text: CONTRATO_CONTINUIDAD });
    }
    for (const p of personajes) {
      const nombre = String(p?.nombre || '').trim().slice(0, 80);
      if (!nombre || !p?.ruta) throw new ErrorEstudio(`Falta la ficha de referencia de ${nombre || 'un personaje'}. No se generó la imagen para no cambiarle la cara.`, { estado: 409, tipo: 'falta_referencia' });
      partes.push(await adjuntar(p.ruta, `la ficha de ${nombre}`));
      partes.push({ text: contratoPersonaje(nombre) });
    }
    if (b.escenario) {
      if (presupuesto > 4 * 1024 * 1024) {
        partes.push(await adjuntar(b.escenario, 'la imagen del escenario'));
        partes.push({ text: CONTRATO_ESCENARIO });
      } else {
        avisos.push('No cupo la imagen del escenario junto a las fichas; se generó con las fichas y el texto del lugar.');
      }
    }
    if (presupuesto < 0) throw new ErrorEstudio('Las fichas de los personajes de este plano pesan demasiado para enviarlas juntas. No se generó; prueba con menos personajes en el plano.', { estado: 413, tipo: 'peticion' });
    const direccion = typeof b.direccion === 'string' ? limpiarPrompt(b.direccion).slice(0, 2500) : '';
    partes.push({ text: `${reglas(personajes.map(p => p.nombre), formato, b.ecchi === true, direccion)}\n\nScene to show:\n${limpiarPrompt(prompt)}` });
  }

  // Modelo global: una sola llamada. Regional: rotación ante cuota.
  const ubicacion = ubicacionImagen(modelo);
  const regiones = ubicacion === 'global' ? ['global'] : (cfg.regionesImagen.length ? cfg.regionesImagen : [ubicacion]);
  let ultimo;
  for (const region of regiones) {
    if (ultimo && limite - Date.now() < 15000) break;
    const res = await pedirAVertex(urlVertex(proyecto, region, modelo, 'generateContent'), partes, proyecto, token, formato, limite);
    if (res.tiempo) throw new ErrorEstudio('Google tardó más de 50 s en dibujar esta imagen y se cortó. Vuelve a intentarlo en un momento.', { estado: 504, tipo: 'tiempo' });
    const leido = leerRespuesta(res, modelo);
    if (leido.imagen) {
      const tipo = /jpe?g/i.test(leido.tipo) ? 'image/jpeg' : 'image/png';
      const guardado = await medios.guardar(token, destino, leido.imagen, tipo);
      return { ruta: destino, url: firmarUrl(cuenta, cfg.bucket, destino), modelo, region, generacion: guardado.generacion, avisos };
    }
    ultimo = leido.error;
    if (!(leido.cuota || leido.rotable)) break;   // un bloqueo o un "sin acceso" es igual en todas las regiones
  }
  throw ultimo;
});
