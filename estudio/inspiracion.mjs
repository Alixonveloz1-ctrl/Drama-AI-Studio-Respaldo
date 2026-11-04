// ════════════════════════════════════════════════════════════════
// INSPIRACIÓN — a partir de un enlace de YouTube que ya funciona, el
// estudio lee su historia y destila su CONCEPTO: la premisa general y
// el motor que la hace avanzar (cómo engancha, cómo narra el
// protagonista, cada cuánto llega un giro o una recompensa, qué se
// repite). Con ese concepto en el formulario, las ideas y el guion se
// escriben como una historia propia, desarrollada de nuevo: no se
// copian las frases del video ni sus nombres, se toma la forma que
// ya demostró funcionar.
//
// Los videos de referencia duran horas: la transcripción se resume
// por trozos y luego se combina, para que quepa en las peticiones.
// ════════════════════════════════════════════════════════════════
import { llamar } from './red.mjs';
import { pedirTexto, parsearJSON } from './texto.mjs';

const PALABRAS_POR_TROZO = 4500;
const MAX_TROZOS = 8;

export function trocear(texto, maxPalabras = PALABRAS_POR_TROZO) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const trozos = [];
  for (let i = 0; i < palabras.length; i += maxPalabras) trozos.push(palabras.slice(i, i + maxPalabras).join(' '));
  return trozos.length ? trozos : [''];
}

// Si hay más trozos de los que se van a resumir, se eligen repartidos
// (el primero y el último siempre: apertura y cierre de la historia).
export function elegirTrozos(trozos, max = MAX_TROZOS) {
  if (trozos.length <= max) return trozos;
  const elegidos = [];
  for (let i = 0; i < max; i++) elegidos.push(trozos[Math.round(i * (trozos.length - 1) / (max - 1))]);
  return [...new Set(elegidos)];
}

const SISTEMA_ANALISTA = 'Eres un analista de dramas cortos que funcionan en redes. Estudias la transcripción de un video para quedarte con su CONCEPTO: la premisa general de la historia y el motor que la hace avanzar. No copias frases del video ni nombres propios: describes la forma de la historia, no su texto.';

function promptTrozo(trozo, n, total) {
  return {
    sistema: SISTEMA_ANALISTA,
    mensaje: `Este es el trozo ${n} de ${total} de la transcripción de un drama corto que funciona muy bien. Resume SOLO lo que se aprende de este trozo, en español y en pocas líneas:
- La historia general: qué pasa en este tramo, en orden (la trama, sin diálogos copiados).
- El mecanismo: qué consigue el protagonista, qué intercambia o qué ventaja usa, y qué gana con ello en este tramo.
- El gancho: cómo arranca o cómo cierra este tramo, y cada cuánto llega un giro o una recompensa.

TRANSCRIPCIÓN:
${trozo}`,
    temperatura: 0.3,
  };
}

function promptConcepto(resumenes) {
  return {
    sistema: SISTEMA_ANALISTA,
    mensaje: `Con estos resúmenes de un drama corto completo que funciona muy bien, destila su CONCEPTO para escribir una historia NUEVA con la misma forma. La premisa se reescribe con palabras propias, como concepto general (de qué trata, qué mecanismo especial tiene el protagonista, qué gana con él y cómo crece), sin copiar frases ni nombres del video. El motor son las reglas de forma que hacen que funcione.

RESÚMENES:
${resumenes.map((r, i) => `— Trozo ${i + 1}: ${r}`).join('\n')}

Devuelve SOLO JSON:
{"premisa": "3 a 5 frases: el concepto general de la historia, listo para usarlo como concepto de un drama nuevo", "motor": ["regla de forma 1 (el gancho de los primeros segundos)", "regla 2 (cómo narra el protagonista)", "regla 3 (cada cuánto llega un giro o una recompensa)", "regla 4 (qué se repite en cada ciclo)", "regla 5 (cómo cierra o engancha al siguiente)"]}`,
    temperatura: 0.4,
  };
}

export function textoDeConcepto({ premisa, motor }) {
  return `${premisa}\n\nMotor de la historia (lo que hace que funcione):\n${(motor || []).map(m => '• ' + m).join('\n')}`;
}

// Lee el video y devuelve el texto de concepto listo para el formulario.
export async function conceptoDesdeEnlace(enlace, { control, aviso } = {}) {
  const datos = await llamar('/api/inspiracion', { metodo: 'POST', cuerpo: { enlace }, senal: control?.abortador.signal });
  const trozos = elegirTrozos(trocear(datos.transcripcion));
  const resumenes = [];
  for (const [i, trozo] of trozos.entries()) {
    aviso?.(`Leyendo la historia del video… (parte ${i + 1} de ${trozos.length})`);
    resumenes.push((await pedirTexto(promptTrozo(trozo, i + 1, trozos.length), { control, aviso })).trim());
  }
  aviso?.('Destilando el concepto de esa historia…');
  let ultimo = '';
  for (let intento = 0; intento < 2; intento++) {
    const json = parsearJSON(await pedirTexto(promptConcepto(resumenes), { control, aviso }));
    const premisa = String(json?.premisa || '').trim();
    const motor = Array.isArray(json?.motor) ? json.motor.map(m => String(m).trim()).filter(Boolean) : [];
    if (premisa.length >= 80 && motor.length >= 3) return { texto: textoDeConcepto({ premisa, motor }), titulo: datos.titulo || '' };
    ultimo = 'la destilación salió incompleta';
  }
  throw new Error(`No pude destilar el concepto de ese video (${ultimo}). Inténtalo de nuevo.`);
}
