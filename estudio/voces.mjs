// ════════════════════════════════════════════════════════════════
// VOCES (navegador) — sección 14.
//
//  · Las voces se le piden a Google (no hay lista escrita aquí).
//  · Cada personaje recibe SU voz automáticamente, distinta de las demás y
//    acorde a si es mujer u hombre (el dueño no tiene que elegir nada; si
//    quiere, puede cambiarla en Personajes). El Sistema y cada extra con
//    nombre también tienen su voz fija. La voz pertenece a la identidad
//    madre: una variante habla con la voz de su personaje.
//  · Defensa contra la deriva de tono (14.2): una llamada por escena —o por
//    tramo de hasta dos hablantes cuando en la escena hablan más—, los dos
//    hablantes en la MISMA llamada, nunca una línea suelta (si hay que
//    rehacer, se rehace la escena entera) y la misma instrucción de estilo
//    en todo el proyecto.
// ════════════════════════════════════════════════════════════════
import { llamar } from './red.mjs';
import { pedirMedio, recordarUrl } from './medios.mjs';
import { sexoDe } from './imagenes.mjs';

export const REGISTROS = [
  { valor: 'normal', etiqueta: 'Normal (actuado y natural)' },
  { valor: 'dramatica', etiqueta: 'Dramática (más intensa)' },
  { valor: 'plana', etiqueta: 'Plana (sin actuar)' },
];
export const registroDe = d => (REGISTROS.some(r => r.valor === d?.ajustes?.registroVoz) ? d.ajustes.registroVoz : 'normal');

let cacheVoces = null;
export async function vocesDisponibles() {
  if (!cacheVoces) cacheVoces = llamar('/api/voz').then(r => r.voces).catch(e => { cacheVoces = null; throw e; });
  return cacheVoces;
}

// Número estable a partir de un texto (para que un extra conserve su voz).
function hash(texto) {
  let h = 0;
  for (const c of String(texto)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Reparte voces a quien no la tenga. Devuelve true si cambió algo.
export function asignarVoces(u, voces) {
  if (!voces?.length) return false;
  const usadas = new Set([...u.personajes.map(p => p.voz), u.vozSistema].filter(Boolean));
  let cambio = false;
  const elegir = (genero, semilla) => {
    const candidatas = voces.filter(v => !genero || v.genero === genero);
    const lista = candidatas.length ? candidatas : voces;
    const libres = lista.filter(v => !usadas.has(v.nombre));
    const de = libres.length ? libres : lista;
    const v = de[hash(semilla) % de.length];
    usadas.add(v.nombre);
    return v.nombre;
  };
  for (const p of u.personajes) {
    if (p.voz && voces.some(v => v.nombre === p.voz)) continue;
    p.voz = elegir(sexoDe(p), p.id + p.nombre);
    cambio = true;
  }
  if (u.tieneSistema && !u.vozSistema) { u.vozSistema = elegir('', 'sistema'); cambio = true; }
  return cambio;
}

// La voz de quien dice una línea.
export function vozDe(u, linea) {
  if (linea.tipo === 'sistema') return u.vozSistema;
  const madre = (u.variantes || []).find(v => v.id === linea.personaje)?.madre;
  const p = u.personajes.find(x => x.id === (madre || linea.personaje));
  if (p) return p.voz;
  // Un extra: voz estable por su nombre, entre las que no usa el reparto.
  u.vocesExtra ||= {};
  return u.vocesExtra[linea.nombre || 'Extra'];
}

export function asignarExtras(u, escenas, voces) {
  u.vocesExtra ||= {};
  const reparto = new Set([...u.personajes.map(p => p.voz), u.vozSistema].filter(Boolean));
  let cambio = false;
  for (const l of escenas.flatMap(e => e.lineas)) {
    const nombre = l.nombre || 'Extra';
    if (l.personaje !== 'extra' || u.vocesExtra[nombre]) continue;
    const libres = voces.filter(v => !reparto.has(v.nombre));
    const de = libres.length ? libres : voces;
    u.vocesExtra[nombre] = de[hash(nombre) % de.length].nombre;
    cambio = true;
  }
  return cambio;
}

// Parte la escena en tramos seguidos de como mucho dos voces distintas.
export function tramosDeEscena(escena, u) {
  const tramos = [];
  let actual = null;
  escena.lineas.forEach((l, indice) => {
    const voz = vozDe(u, l);
    if (!voz) throw new Error(`Falta la voz de ${l.tipo === 'sistema' ? 'el Sistema' : l.nombre || l.personaje}.`);
    if (!actual || (!actual.voces.includes(voz) && actual.voces.length === 2)) {
      actual = { voces: [], lineas: [] };
      tramos.push(actual);
    }
    if (!actual.voces.includes(voz)) actual.voces.push(voz);
    actual.lineas.push({ hablante: actual.voces.indexOf(voz), texto: l.texto, pensamiento: l.tipo === 'pensamiento', indice });
  });
  return tramos;
}

// Genera la voz de una escena entera (todos sus tramos). Solo se guarda
// cuando están todos: una escena nunca queda con la mitad de voces nuevas.
export async function vozEscena({ proyectoId, datos, escena, control, aviso, guardar }) {
  const u = datos.universo;
  const voces = await vocesDisponibles();
  if (asignarVoces(u, voces) | asignarExtras(u, [escena], voces)) await guardar();
  const tramos = tramosDeEscena(escena, u);
  const registro = registroDe(datos);
  const hechos = [];
  for (const [i, t] of tramos.entries()) {
    aviso?.(`voz de la escena · tramo ${i + 1} de ${tramos.length}…`);
    const r = await pedirMedio('/api/voz', {
      proyecto: proyectoId, clave: `voz-${escena.id}-${i + 1}`, registro,
      hablantes: t.voces.map(voz => ({ voz })),
      lineas: t.lineas.map(l => ({ hablante: l.hablante, texto: l.texto, pensamiento: l.pensamiento })),
    }, { control, aviso });
    recordarUrl(r.ruta, r.url);
    hechos.push({ ruta: r.ruta, segundos: r.segundos || 0, lineas: t.lineas.map(l => l.indice) });
  }
  escena.voz = { tramos: hechos, registro, fecha: Date.now() };
  await guardar();
  return escena.voz;
}

export const segundosVoz = escena => (escena.voz?.tramos || []).reduce((n, t) => n + (t.segundos || 0), 0);
