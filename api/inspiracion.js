// ════════════════════════════════════════════════════════════════
// INSPIRACIÓN — lee los subtítulos de un video de YouTube que el dueño
// pega en el formulario. El navegador, con esa transcripción, destila
// el concepto y la historia general de ese video (su premisa y su
// motor) para escribir una historia propia con la misma forma.
// Sin subtítulos legibles no se inventa nada: se devuelve el error y
// el dueño lo sabe. No se descarga el video, solo su texto.
// ════════════════════════════════════════════════════════════════
const puerta = require('./_lib/puerta');
const { ErrorEstudio } = require('./_lib/errores');
const yt = require('./_lib/youtube');

module.exports = puerta({ metodos: ['POST'] }, async (req) => {
  const id = yt.idDeEnlace(req.body?.enlace || '');
  if (!id) {
    throw new ErrorEstudio('Ese enlace no parece de un video de YouTube. Pega el enlace completo del video.', { estado: 400, tipo: 'peticion' });
  }
  let html;
  try {
    const r = await fetch('https://www.youtube.com/watch?v=' + id + '&hl=es', {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
      signal: AbortSignal.timeout(15000),
    });
    html = await r.text();
  } catch {
    throw new ErrorEstudio('No se pudo abrir ese video en YouTube. Revisa el enlace e inténtalo de nuevo.', { estado: 502, tipo: 'google' });
  }
  const pista = yt.elegirPista(yt.pistasDeHtml(html));
  if (!pista) {
    throw new ErrorEstudio('Ese video no trae subtítulos que se puedan leer, y sin ellos no puedo escuchar su historia. Prueba con otro video.', { estado: 422, tipo: 'sin_subtitulos' });
  }
  let texto = '';
  try {
    const r = await fetch(pista.baseUrl + '&fmt=json3', { signal: AbortSignal.timeout(15000) });
    texto = yt.textoDeJson3(await r.json());
  } catch {
    throw new ErrorEstudio('Los subtítulos de ese video no se pudieron bajar. Inténtalo de nuevo.', { estado: 502, tipo: 'google' });
  }
  if (texto.length < 200) {
    throw new ErrorEstudio('Los subtítulos de ese video están casi vacíos: no hay historia que estudiar ahí.', { estado: 422, tipo: 'sin_subtitulos' });
  }
  return { titulo: yt.tituloDeHtml(html), transcripcion: texto.slice(0, 160000) };
});
