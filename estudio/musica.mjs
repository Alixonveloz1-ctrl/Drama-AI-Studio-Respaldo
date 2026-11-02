// ════════════════════════════════════════════════════════════════
// MÚSICA (navegador) — una pista por acto con Lyria (sección 14.4).
//
//  · Actos: cada bloque del guion es un acto; en la prueba de 3 minutos (un
//    solo bloque) se parte en dos, para que la banda sonora cambie.
//  · El director escribe cada brief en inglés (Lyria no acepta otro idioma).
//  · Cada pista dura unos 30 s; el montaje la repite con fundidos bajo
//    todo su acto, por debajo de las voces.
// ════════════════════════════════════════════════════════════════
import { pedirTexto, parsearJSON } from './texto.mjs';
import { pedirMedio, recordarUrl } from './medios.mjs';
import { promptMusica, segundosDe } from './prompts.mjs';
import { contarPalabras } from './guion.mjs';
import { segundosVoz } from './voces.mjs';

export function actosDelEpisodio(ep) {
  const bloques = ep?.bloques || [];
  let grupos = bloques.map(b => b.escenas);
  if (grupos.length === 1 && grupos[0].length >= 2) {
    const mitad = Math.ceil(grupos[0].length / 2);
    grupos = [grupos[0].slice(0, mitad), grupos[0].slice(mitad)];
  }
  return grupos.map((escenas, i) => ({
    numero: i + 1,
    escenas: escenas.map(e => e.id),
    segundos: escenas.reduce((n, e) => n + (segundosVoz(e) || segundosDe(contarPalabras(e.lineas.map(l => l.texto).join(' ')))), 0),
    resumen: escenas.map(e => `${e.titulo}: ${e.accion}`).join(' / ').slice(0, 600),
  }));
}

export function validarMusica(json, actos) {
  const problemas = [];
  const briefs = {};
  for (const a of actos) {
    const brief = String((json?.pistas || []).find(p => Number(p?.acto) === a.numero)?.brief || '').replace(/\s+/g, ' ').trim();
    if (contarPalabras(brief) < 15) problemas.push(`falta la descripción del acto ${a.numero}`);
    else if (/[áéíóúñ¿¡]/i.test(brief)) problemas.push(`la descripción del acto ${a.numero} tiene español y Lyria solo acepta inglés`);
    else briefs[a.numero] = brief;
  }
  return { problemas, briefs };
}

// Escribe los briefs que falten y genera las pistas que falten, una a una.
export async function generarMusica({ proyectoId, datos, numero, control, aviso, guardar, alAvanzar }) {
  const ep = datos.episodios[numero];
  const actos = actosDelEpisodio(ep);
  ep.musica ||= {};
  const sinBrief = actos.filter(a => !ep.musica[a.numero]?.brief);
  if (sinBrief.length) {
    let comentario = '', ultimo = '';
    for (let intento = 0; intento < 3 && sinBrief.some(a => !ep.musica[a.numero]?.brief); intento++) {
      aviso?.('El compositor escribe la música de cada acto…');
      const p = promptMusica(datos, sinBrief);
      const json = parsearJSON(await pedirTexto({ ...p, mensaje: p.mensaje + comentario }, { control, aviso }));
      const { problemas, briefs } = validarMusica(json, sinBrief);
      for (const [n, brief] of Object.entries(briefs)) ep.musica[n] = { ...(ep.musica[n] || {}), brief };
      ultimo = problemas.join('; ');
      comentario = problemas.length ? `\n\nREINTENTO OBLIGATORIO: ${ultimo}.` : '';
    }
    if (sinBrief.some(a => !ep.musica[a.numero]?.brief)) throw new Error(`El compositor no escribió la música de todos los actos (${ultimo}).`);
    await guardar();
  }
  let hechas = 0;
  for (const a of actos) {
    const pista = ep.musica[a.numero];
    if (pista.ruta) continue;
    aviso?.(`música del acto ${a.numero} de ${actos.length}…`);
    const r = await pedirMedio('/api/musica', { proyecto: proyectoId, clave: `musica-ep${numero}-${a.numero}`, brief: pista.brief }, { control, aviso });
    recordarUrl(r.ruta, r.url);
    ep.musica[a.numero] = { ...pista, ruta: r.ruta, segundos: r.segundos || 30, fecha: Date.now() };
    hechas++;
    await guardar();
    alAvanzar?.();
  }
  return hechas;
}
