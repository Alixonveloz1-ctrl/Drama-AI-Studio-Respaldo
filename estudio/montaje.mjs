// ════════════════════════════════════════════════════════════════
// MONTAJE (navegador) — sección 16 y export ZIP (16.3).
//
//  · Arma la HOJA DE MONTAJE con datos: cada plano con su duración, cada
//    tramo de voz en su instante, la música por actos y los subtítulos. El
//    guion de FFmpeg lo escribe el servidor a partir de ella.
//  · Cada escena dura exactamente su narración (más una entrada y una cola
//    cortas); sus planos se reparten ese tiempo según su peso editorial.
//  · Un plano con video usa el clip (se retima en el montador); sin video,
//    su imagen con movimiento de cámara.
//  · El trabajo de Cloud Run tarda minutos: se guarda la operación en el
//    proyecto y se sigue consultando aunque se recargue la página.
// ════════════════════════════════════════════════════════════════
import { llamar } from './red.mjs';
import { pedirMedio, recordarUrl } from './medios.mjs';
import { errorDetenido, esCuota } from './texto.mjs';
import { escenasDelEpisodio, nombreDe } from './desglose.mjs';
import { actosDelEpisodio } from './musica.mjs';
import { frasesDeLinea } from './subtitulos.mjs';

export const ENTRADA = 0.35, PAUSA = 0.25, COLA = 0.5;
export const MINIMO_PLANO = 0.5;

// Reparte D segundos entre los planos según su peso, sin bajar de un mínimo
// por plano. Si ni con el mínimo caben, la escena se alarga lo justo.
export function repartir(pesos, D) {
  const n = pesos.length;
  const total = Math.max(D, n * MINIMO_PLANO);
  let fijos = new Array(n).fill(false);
  let durs = [];
  for (let vuelta = 0; vuelta < n; vuelta++) {
    const libre = total - fijos.reduce((s, f) => s + (f ? MINIMO_PLANO : 0), 0);
    const suma = pesos.reduce((s, w, i) => s + (fijos[i] ? 0 : (w || 1)), 0) || 1;
    durs = pesos.map((w, i) => (fijos[i] ? MINIMO_PLANO : libre * (w || 1) / suma));
    const nuevos = durs.map((d, i) => !fijos[i] && d < MINIMO_PLANO);
    if (!nuevos.some(Boolean)) break;
    fijos = fijos.map((f, i) => f || nuevos[i]);
  }
  return { durs, total };
}
const CONSULTA_CADA = 15;

const dos = n => String(n).padStart(2, '0');

// Qué falta para poder montar. Las voces y la música las genera el propio
// botón de montar; las imágenes no (son lo caro y lo que el dueño revisa).
export function estadoDelEpisodio(datos, numero) {
  const ep = datos.episodios?.[numero];
  const escenas = escenasDelEpisodio(datos, numero);
  const planos = escenas.flatMap(e => e.planos || []);
  const actos = actosDelEpisodio(ep);
  return {
    escenas: escenas.length,
    sinDesglose: escenas.filter(e => !e.planos?.length).length,
    planos: planos.length,
    sinImagen: planos.filter(p => !p.imagen || p.imagenObsoleta).length,
    accion: planos.filter(p => p.tipo === 'accion').length,
    sinVideo: planos.filter(p => p.tipo === 'accion' && (!p.video || p.videoObsoleto)).length,
    sinVoz: escenas.filter(e => !e.voz?.tramos?.length || e.voz.obsoleta).length,
    actos: actos.length,
    sinMusica: actos.filter(a => !ep?.musica?.[a.numero]?.ruta).length,
  };
}

const duracionEscena = e => ENTRADA + (e.voz?.tramos || []).reduce((n, t) => n + (t.segundos || 0), 0) + PAUSA * Math.max(0, (e.voz?.tramos?.length || 1) - 1) + COLA;

// La hoja del episodio montado.
export function hojaDeVideo(datos, numero) {
  const ep = datos.episodios[numero];
  const escenas = escenasDelEpisodio(datos, numero);
  const planos = [], voces = [], subtitulos = [], inicioDe = {};
  let t0 = 0;
  for (const e of escenas) {
    if (!e.planos?.length) throw new Error(`La escena «${e.titulo}» no tiene desglose de planos.`);
    if (!e.voz?.tramos?.length) throw new Error(`La escena «${e.titulo}» no tiene voz.`);
    const { durs, total: D } = repartir(e.planos.map(p => p.peso || 1), duracionEscena(e));
    inicioDe[e.id] = { inicio: t0, duracion: D };
    e.planos.forEach((p, i) => {
      if (!p.imagen?.ruta || p.imagenObsoleta) throw new Error(`Falta la imagen del plano ${i + 1} de «${e.titulo}».`);
      const d = durs[i];
      const video = p.video?.ruta && !p.videoObsoleto;
      planos.push({ tipo: video ? 'video' : 'imagen', ruta: video ? p.video.ruta : p.imagen.ruta, duracion: Number(d.toFixed(3)), sistema: p.sistema || '' });
    });
    let t = t0 + ENTRADA;
    for (const tr of e.voz.tramos) {
      voces.push({ ruta: tr.ruta, inicio: Number(t.toFixed(3)) });
      tr.lineas.forEach((indice, k) => {
        const linea = e.lineas[indice];
        const tiempos = tr.tiempos?.[k] || { inicio: (tr.segundos || 0) * k / tr.lineas.length, fin: (tr.segundos || 0) * (k + 1) / tr.lineas.length };
        // Los paneles del Sistema ya muestran su texto: no se duplica abajo.
        if (!linea || linea.tipo === 'sistema') return;
        subtitulos.push(...frasesDeLinea(linea.texto, t + tiempos.inicio, t + tiempos.fin));
      });
      t += (tr.segundos || 0) + PAUSA;
    }
    t0 += D;
  }
  const musica = actosDelEpisodio(ep)
    .filter(a => ep.musica?.[a.numero]?.ruta && a.escenas.length)
    .map(a => {
      const desde = inicioDe[a.escenas[0]]?.inicio ?? 0;
      const hasta = a.escenas.reduce((n, id) => n + (inicioDe[id]?.duracion || 0), 0);
      return { ruta: ep.musica[a.numero].ruta, inicio: Number(desde.toFixed(3)), duracion: Number(Math.max(1, hasta).toFixed(3)) };
    });
  const redondear = s => ({ ...s, inicio: Number(s.inicio.toFixed(3)), fin: Number(s.fin.toFixed(3)) });
  return { modo: 'video', episodio: numero, formato: datos.formulario.formato, planos, voces, musica, subtitulos: subtitulos.map(redondear) };
}

const slug = t => String(t || 'x').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';

// La hoja del ZIP con todo el material del episodio.
export function hojaDeZip(datos, numero) {
  const u = datos.universo;
  const ep = datos.episodios[numero];
  const escenas = escenasDelEpisodio(datos, numero);
  const archivos = [];
  const ext = r => (r.split('.').pop() || 'bin').toLowerCase();
  for (const p of u.personajes) if (p.referencia?.ruta) archivos.push({ ruta: p.referencia.ruta, nombre: `personajes/${slug(p.nombre)}.${ext(p.referencia.ruta)}` });
  for (const v of u.variantes || []) if (v.referencia?.ruta) archivos.push({ ruta: v.referencia.ruta, nombre: `personajes/${slug(v.nombre)}.${ext(v.referencia.ruta)}` });
  escenas.forEach((e, n) => {
    (e.planos || []).forEach((p, i) => {
      const base = `escena-${dos(n + 1)}-plano-${dos(i + 1)}`;
      if (p.imagen?.ruta) archivos.push({ ruta: p.imagen.ruta, nombre: `imagenes/${base}.${ext(p.imagen.ruta)}` });
      if (p.video?.ruta) archivos.push({ ruta: p.video.ruta, nombre: `videos/${base}.mp4` });
    });
    (e.voz?.tramos || []).forEach((t, i) => archivos.push({ ruta: t.ruta, nombre: `voces/escena-${dos(n + 1)}-tramo-${i + 1}.wav` }));
  });
  for (const [acto, m] of Object.entries(ep.musica || {})) if (m.ruta) archivos.push({ ruta: m.ruta, nombre: `musica/acto-${acto}.wav` });
  if (ep.resultados?.video?.ruta) archivos.push({ ruta: ep.resultados.video.ruta, nombre: `episodio-${dos(numero)}.mp4` });

  const guion = escenas.map((e, n) => `ESCENA ${n + 1} — ${e.titulo}\n${e.accion}\n${e.lineas.map(l => `${l.tipo === 'sistema' ? 'SISTEMA' : l.personaje === 'extra' ? (l.nombre || 'Extra') : nombreDe(u, l.personaje)}${l.tipo === 'pensamiento' ? ' (piensa)' : ''}: ${l.texto}`).join('\n')}`).join('\n\n');
  const b = datos.biblia || {};
  const direccion = [
    `${u.titulo}\n${u.gancho}\n\nPREMISA\n${u.premisa}\n\nMUNDO\n${u.mundo}`,
    `PERSONAJES\n${u.personajes.map(p => `- ${p.nombre} (${p.rol}, ${p.edad} años): ${p.aspecto}`).join('\n')}`,
    `LUGARES\n${u.escenarios.map(e => `- ${e.nombre}: ${e.descripcion}${e.ficha ? `\n  Ficha: ${e.ficha}` : ''}`).join('\n')}`,
    `BIBLIA DE LA SERIE\nDirección visual: ${b.direccionVisual || ''}\nIdentidad musical: ${b.identidadMusical || ''}\nRitmo narrativo: ${b.ritmoNarrativo || ''}\nRitmo de montaje: ${b.ritmoMontaje || ''}`,
    `MÚSICA POR ACTOS\n${Object.entries(ep.musica || {}).map(([a, m]) => `Acto ${a}: ${m.brief || ''}`).join('\n')}`,
  ].join('\n\n');
  const textos = [{ nombre: 'guion.txt', contenido: guion }, { nombre: 'direccion-creativa.txt', contenido: direccion }];
  try {
    const h = hojaDeVideo(datos, numero);
    const t = s => { const ms = Math.round(s * 1000); return `${dos(Math.floor(ms / 3600000))}:${dos(Math.floor(ms / 60000) % 60)}:${dos(Math.floor(ms / 1000) % 60)},${String(ms % 1000).padStart(3, '0')}`; };
    textos.push({ nombre: 'subtitulos.srt', contenido: h.subtitulos.map((s, i) => `${i + 1}\n${t(s.inicio)} --> ${t(s.fin)}\n${s.texto}\n`).join('\n') });
  } catch { /* sin voces todavía: el ZIP va sin subtítulos */ }
  return { modo: 'zip', episodio: numero, archivos, textos };
}

async function dormir(segundos, control) {
  for (let i = 0; i < segundos * 4; i++) {
    if (control?.detenido) throw errorDetenido();
    await new Promise(listo => setTimeout(listo, 250));
  }
}

// Lanza (o sigue) el trabajo de montaje o de ZIP y espera a que termine.
export async function montar({ proyectoId, datos, numero, modo, control, aviso, guardar, cada = CONSULTA_CADA }) {
  const ep = datos.episodios[numero];
  ep.trabajos ||= {};
  if (!ep.trabajos[modo]?.operacion) {
    const hoja = modo === 'zip' ? hojaDeZip(datos, numero) : hojaDeVideo(datos, numero);
    aviso?.(modo === 'zip' ? 'Preparando el ZIP…' : 'Enviando el episodio al montador…');
    const r = await pedirMedio('/api/montaje', { accion: 'iniciar', proyecto: proyectoId, hoja }, { control, aviso });
    ep.trabajos[modo] = { operacion: r.operacion, ruta: r.ruta, carpeta: r.carpeta, inicio: Date.now() };
    await guardar();
  }
  const trabajo = ep.trabajos[modo];
  let fallos = 0;
  for (;;) {
    await dormir(cada, control);
    const pasados = Math.round((Date.now() - trabajo.inicio) / 1000);
    aviso?.(`${modo === 'zip' ? 'Haciendo el ZIP' : 'Montando el episodio'} en Google (${Math.floor(pasados / 60)} min ${pasados % 60} s)…`);
    let r;
    try {
      r = await llamar('/api/montaje', { metodo: 'POST', cuerpo: { accion: 'estado', proyecto: proyectoId, operacion: trabajo.operacion, carpeta: trabajo.carpeta, ruta: trabajo.ruta }, senal: control?.abortador.signal });
      fallos = 0;
    } catch (e) {
      if (e.detenido || control?.detenido) throw errorDetenido();
      if ((esCuota(e) || e.reintentable) && ++fallos <= 8) continue;
      if (e.tipo === 'montaje_fallo') { delete ep.trabajos[modo]; await guardar(); }
      throw e;
    }
    if (!r.listo) continue;
    recordarUrl(r.ruta, r.ver);
    ep.resultados ||= {};
    ep.resultados[modo] = { ruta: r.ruta, fecha: Date.now() };
    delete ep.trabajos[modo];
    await guardar();
    return { ...ep.resultados[modo], url: r.url, ver: r.ver };
  }
}
