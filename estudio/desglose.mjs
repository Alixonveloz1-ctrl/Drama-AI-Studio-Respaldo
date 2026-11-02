// ════════════════════════════════════════════════════════════════
// DESGLOSE DE PLANOS (director de fotografía) y REVISIÓN DE PUESTA EN
// ESCENA (director de arte) — secciones 7.3, 7.4 y 11.
//
//  · Dos tipos de plano: ACCIÓN (alguien hace algo; se anima con Veo, 4 s) y
//    COBERTURA (una cara que reacciona, una mano, un objeto, un paisaje;
//    imagen fija con movimiento de cámara en el montaje, 1,5 a 3 s).
//    Proporción objetivo 70 % acción / 30 % cobertura, contando planos.
//  · Lo hace el director solo, sin pantalla de confirmación; el dueño solo
//    puede pedir que se rehaga el desglose de una escena.
//  · Cada plano queda anclado a un fragmento LITERAL y ordenado de la escena:
//    no puede adelantar acontecimientos.
//  · Peso editorial de 1 a 5: el audio se reparte según esos pesos.
//  · Mínimo de planos por palabras: <18 → 1; 18-35 → 2; 36+ → 3.
//  · Los trucos de encubrimiento van dentro del desglose (cortar antes de que
//    termine un movimiento complejo y poner una reacción, etc.).
//  · El director de arte revisa cada 5 escenas. Cuando corrige un plano NO
//    borra nada: marca la imagen como obsoleta y deja decidir. Si no pudo
//    revisar, lo dice: nunca informa «sin fallos» de algo que no miró.
// ════════════════════════════════════════════════════════════════
import { pedirTexto, parsearJSON } from './texto.mjs';
import { contarPalabras, normalizar } from './guion.mjs';
import { contextoEleccion, segundosDe } from './prompts.mjs';

const POR_LLAMADA = 5;          // escenas como mucho por petición
const PLANOS_POR_LLAMADA = 24;  // y planos mínimos sumados: la respuesta tiene que caber en el tiempo
const REVISAR_CADA = 5;         // el director de arte revisa cada 5 escenas
const INTENTOS = 3;

export function textoEscena(e) {
  return e.lineas.map(l => l.texto).join(' ');
}

export function minimoPlanos(escena) {
  const palabras = contarPalabras(textoEscena(escena));
  const porPalabras = palabras < 18 ? 1 : palabras < 36 ? 2 : 3;
  return Math.max(porPalabras, Math.ceil(segundosDe(palabras) / 4));
}
export function maximoPlanos(escena) {
  return Math.max(minimoPlanos(escena) + 1, Math.ceil(segundosDe(contarPalabras(textoEscena(escena))) / 1.5) + 1);
}

function fichaVisual(u) {
  const personajes = u.personajes.map(p => `- ${p.id} = ${p.nombre}: ${p.appearance}`).join('\n');
  const variantes = (u.variantes || []).map(v => `- ${v.id} = ${v.nombre} (variante de ${v.madre}): ${v.cambio}`).join('\n');
  const escenarios = u.escenarios.map(e => `- ${e.id} = ${e.nombre} (${e.interior ? 'INTERIOR' : 'EXTERIOR'}): ${e.description || e.descripcion}`).join('\n');
  return `PERSONAJES (aspecto en inglés para los prompts):\n${personajes}${variantes ? `\nVARIANTES (usa su id cuando el personaje aparece así):\n${variantes}` : ''}\n\nESCENARIOS (inventario cerrado):\n${escenarios}`;
}

function escenasParaPrompt(u, escenas) {
  const nombres = Object.fromEntries(u.personajes.map(p => [p.id, p.nombre]));
  return escenas.map(e => {
    const lineas = e.lineas.map(l => `${l.tipo === 'sistema' ? 'SISTEMA' : (nombres[l.personaje] || l.nombre || l.personaje)}${l.tipo === 'pensamiento' ? ' (piensa)' : ''}: ${l.texto}`).join('\n');
    const palabras = contarPalabras(textoEscena(e));
    return `═══ ESCENA ${e.id} — «${e.titulo}» — escenario ${e.escenario} — ${palabras} palabras (≈ ${Math.round(segundosDe(palabras))} s de audio) — MÍNIMO ${minimoPlanos(e)} planos, máximo ${maximoPlanos(e)}
Lo que se ve al empezar: ${e.accion}
${lineas}`;
  }).join('\n\n');
}

export const SISTEMA_FOTOGRAFIA = `Eres el DIRECTOR DE FOTOGRAFÍA de un drama corto asiático semirrealista que se mira en el teléfono. Decides cuántos planos tiene cada escena, qué muestra cada uno y su movimiento, a partir del guion YA ESCRITO. No inventas historia.

DOS TIPOS DE PLANO (el ritmo sale de alternarlos):
- "accion": alguien camina, pelea, construye, nada, conduce o manipula un objeto. Se anima con video: dura 4 segundos.
- "cobertura": una cara que reacciona, una mano, un objeto o un plano general de paisaje. Es imagen fija con movimiento de cámara en el montaje: 1,5 a 3 segundos.
- Proporción objetivo: 70 % acción y 30 % cobertura, contando planos.

REGLAS DEL DESGLOSE:
- Cada plano lleva "ancla": de 4 a 14 palabras CONSECUTIVAS copiadas literalmente del texto de la escena (de sus líneas o de lo que se ve al empezar). Las anclas siguen el orden del texto: un plano nunca muestra algo que ocurre después de su ancla.
- Estado físico acumulado: entre planos se conservan posición, ropa, lesiones, objetos y quién está presente. Un corte cambia el encuadre, no la realidad.
- Peso editorial de 1 a 5 por plano: la frase o la acción principal pesa más que un detalle o una reacción rápida.
- Personajes visibles: ids exactos del reparto (o de una variante), como máximo 3 por plano.
- Nadie mira a la cámara ni le habla al espectador: los personajes actúan dentro de la escena.

TRUCOS DE ENCUBRIMIENTO (obligatorios, ocultan los fallos de la IA):
- Cuando un plano tiene movimiento complejo de manos o de cuerpo entero, córtalo antes de que el movimiento termine y pon a continuación un primer plano de reacción.
- El primer plano de reacción es el comodín: barato, tapa cualquier fallo del plano anterior y refuerza la reacción del ciclo.
- Para un salto de tiempo, usa un plano general de paisaje (cobertura) en vez de generar una transición.

INVENTARIO CERRADO DEL LUGAR: solo existen los muebles y objetos grandes que la descripción del escenario menciona o que cualquiera daría por sentados en ESE lugar. Si la acción necesita algo que el lugar no tiene, reescribe la acción con lo que sí hay. En un interior, la lluvia o la nieve solo se ven por la ventana o la puerta, nunca dentro.

LITERALIDAD: una figura sobre un sentimiento («le hervía la sangre») se filma como gesto o postura, nunca como efecto especial.

CADA "prompt" (EN INGLÉS):
- Empieza con "Scene with [nombre] ([media frase de identidad: pelo y ropa del momento])" por cada personaje visible, o "Scene without people:".
- Describe el encuadre (wide shot / medium shot / close-up / insert), la acción del instante del ancla, el lugar y la luz.
- Personajes de lado, de tres cuartos o de espaldas: nunca mirando a cámara.
- Prohibido: naked, nude, explicit, sexual, genitals, nipples. Sin texto, letras ni carteles legibles.
"movimiento" (EN INGLÉS, solo en planos de acción): la acción breve y clara que hará el video, sin movimientos de cámara inventados.

Respondes SOLO JSON válido.`;

export function promptDesglose(datos, escenas, extra = '') {
  const u = datos.universo;
  return {
    sistema: SISTEMA_FOTOGRAFIA,
    mensaje: `${contextoEleccion(datos.formulario)}

${fichaVisual(u)}

DIRECCIÓN VISUAL DE LA SERIE: ${datos.biblia?.direccionVisual || ''}
RITMO DE MONTAJE: ${datos.biblia?.ritmoMontaje || ''}
Formato de imagen: ${datos.formulario.formato === '16:9' ? '16:9 horizontal' : '9:16 vertical: encuadres verticales, personajes centrados, poco aire lateral'}.

${escenasParaPrompt(u, escenas)}
${extra}
Devuelve JSON con EXACTAMENTE ${escenas.length} escenas, en el mismo orden:
{"escenas":[{"id":"${escenas[0].id}","planos":[{"tipo":"accion | cobertura","ancla":"palabras copiadas del texto","personajes":["c1"],"peso":3,"prompt":"Scene with …","movimiento":"… (solo acción)","sistema":"texto de la línea del Sistema que aparece sobre este plano, o vacío"}]}]}`,
    temperatura: 0.5,
  };
}

// ─── Revisión ───
export function validarDesglose(json, escenas, universo) {
  const problemas = [];
  const ids = new Set([...universo.personajes.map(p => p.id), ...(universo.variantes || []).map(v => v.id)]);
  const crudas = Array.isArray(json?.escenas) ? json.escenas : [];
  const resultado = {};
  let accion = 0, total = 0;
  for (const escena of escenas) {
    const c = crudas.find(x => x?.id === escena.id);
    if (!c) { problemas.push(`falta el desglose de la escena ${escena.id}`); continue; }
    const planos = (Array.isArray(c.planos) ? c.planos : []).map(p => ({
      tipo: p?.tipo === 'accion' ? 'accion' : 'cobertura',
      ancla: String(p?.ancla || '').trim(),
      personajes: [...new Set((Array.isArray(p?.personajes) ? p.personajes : []).map(String).filter(id => ids.has(id)))].slice(0, 3),
      peso: Math.max(1, Math.min(5, Math.round(Number(p?.peso) || 2))),
      prompt: String(p?.prompt || '').trim(),
      movimiento: String(p?.movimiento || '').trim(),
      sistema: String(p?.sistema || '').trim(),
    }));
    if (planos.length < minimoPlanos(escena)) problemas.push(`la escena ${escena.id} tiene ${planos.length} planos y necesita al menos ${minimoPlanos(escena)}`);
    if (planos.length > maximoPlanos(escena)) problemas.push(`la escena ${escena.id} tiene demasiados planos (${planos.length}; máximo ${maximoPlanos(escena)})`);
    // Lo que se ve al empezar va primero: es el principio de la escena.
    const texto = normalizar(escena.accion + ' ' + textoEscena(escena));
    let desde = 0;
    planos.forEach((p, i) => {
      const ancla = normalizar(p.ancla);
      const valida = contarPalabras(p.ancla) >= 3;
      const pos = valida ? texto.indexOf(ancla, desde) : -1;
      if (pos >= 0) desde = pos;
      else if (valida && texto.includes(ancla)) problemas.push(`el plano ${i + 1} de la escena ${escena.id} retrocede respecto al orden del texto`);
      else problemas.push(`el ancla del plano ${i + 1} de la escena ${escena.id} no está copiada literalmente del texto`);
      if (p.prompt.length < 40) problemas.push(`el plano ${i + 1} de la escena ${escena.id} no tiene un prompt suficiente`);
      if (/looking at (?:the )?camera|looks at (?:the )?camera|faces the camera|addressing the viewer/i.test(p.prompt)) problemas.push(`en el plano ${i + 1} de la escena ${escena.id} alguien mira a cámara`);
      if (p.tipo === 'accion' && !p.movimiento) problemas.push(`el plano de acción ${i + 1} de la escena ${escena.id} no dice qué movimiento hace el video`);
    });
    accion += planos.filter(p => p.tipo === 'accion').length;
    total += planos.length;
    resultado[escena.id] = planos;
  }
  if (total >= 6) {
    const parte = accion / total;
    if (parte < 0.55 || parte > 0.85) problemas.push(`la proporción de planos de acción es ${Math.round(parte * 100)} % y debe rondar el 70 %`);
  }
  return { problemas, resultado };
}

export const SISTEMA_ARTE = `Eres el DIRECTOR DE ARTE y de continuidad. Lees prompts de imagen YA ESCRITOS y los contrastas con su escenario y con el texto de la escena, para cazar fallos antes de que cuesten imágenes: atrezo imposible (un mueble que ese lugar no tiene), clima imposible (lluvia dentro de un interior), un personaje en un sitio en el que no puede estar, ropa o heridas que cambian sin motivo, alguien mirando a cámara.
No cambias la historia ni el encuadre que funciona. Solo corriges lo que está mal, y explicas por qué.
Respondes SOLO JSON válido.`;

export function promptRevision(datos, escenas) {
  const u = datos.universo;
  const lista = escenas.map(e => `═══ ESCENA ${e.id} — escenario ${e.escenario}\nTexto: ${textoEscena(e)}\n${(e.planos || []).map((p, i) => `Plano ${i + 1} (${p.tipo}): ${p.prompt}`).join('\n')}`).join('\n\n');
  return {
    sistema: SISTEMA_ARTE,
    mensaje: `${fichaVisual(u)}

${lista}

Devuelve JSON: {"revisadas":["ids de las escenas que revisaste"],"correcciones":[{"escena":"e1","plano":1,"prompt":"prompt completo corregido en inglés","motivo":"qué estaba mal, en español"}]}
Si un plano está bien, no lo incluyas. "revisadas" lista TODAS las escenas que de verdad miraste.`,
    temperatura: 0.3,
  };
}

// ─── Proceso ───
async function pedirValidado(prompt, validar, { control, aviso, etiqueta }) {
  let comentario = '', ultimo = '';
  for (let intento = 0; intento < INTENTOS; intento++) {
    aviso?.(intento ? `${etiqueta}: intento ${intento + 1} de ${INTENTOS}…` : `${etiqueta}…`);
    const crudo = await pedirTexto({ ...prompt, mensaje: prompt.mensaje + comentario }, { control, aviso });
    let json;
    try { json = parsearJSON(crudo); } catch {
      ultimo = 'la respuesta no era un JSON válido';
      comentario = '\n\nREINTENTO: devuelve SOLO el JSON pedido.';
      continue;
    }
    const r = validar(json);
    if (!r.problemas.length) return r;
    ultimo = r.problemas.slice(0, 8).join('; ');
    comentario = `\n\nREINTENTO OBLIGATORIO: se rechazó porque ${ultimo}. Corrígelo y devuelve el desglose completo.`;
  }
  throw Object.assign(new Error(`${etiqueta}: el director no cumplió las reglas después de ${INTENTOS} intentos (${ultimo}). Lo ya guardado se conserva.`), { tipo: 'formato' });
}

export function escenasDelEpisodio(datos, numero) {
  return (datos.episodios?.[numero]?.bloques || []).flatMap(b => b.escenas);
}

// Agrupa escenas seguidas sin pasarse de escenas ni de planos por petición.
export function agrupar(escenas) {
  const grupos = [];
  let actual = [], planos = 0;
  for (const e of escenas) {
    const m = minimoPlanos(e);
    if (actual.length && (actual.length >= POR_LLAMADA || planos + m > PLANOS_POR_LLAMADA)) { grupos.push(actual); actual = []; planos = 0; }
    actual.push(e);
    planos += m;
  }
  if (actual.length) grupos.push(actual);
  return grupos;
}

// Desglosa las escenas que no lo tienen (o solo una, si se pide rehacerla).
export async function desglosar(datos, numero, { control, aviso, guardar, soloEscena, alAvanzar }) {
  const todas = escenasDelEpisodio(datos, numero);
  const pendientes = soloEscena ? todas.filter(e => e.id === soloEscena) : todas.filter(e => !e.planos?.length);
  const informe = { revisadas: 0, correcciones: 0, sinRevisar: [] };
  const grupos = agrupar(pendientes);
  let hechas = 0, porRevisar = [];
  const revisarLo = async () => {
    const lote = porRevisar;
    porRevisar = [];
    try {
      const r = await revisar(datos, lote, { control, aviso, guardar });
      informe.revisadas += r.revisadas; informe.correcciones += r.correcciones; informe.sinRevisar.push(...r.sinRevisar);
    } catch (e) {
      if (e.detenido) throw e;
      informe.sinRevisar.push(...lote.map(g => g.id));
    }
    alAvanzar?.();
  };
  for (const [g, grupo] of grupos.entries()) {
    const etiqueta = `Desglose de planos: escenas ${hechas + 1} a ${hechas + grupo.length} de ${pendientes.length}`;
    let resultado;
    try {
      ({ resultado } = await pedirValidado(promptDesglose(datos, grupo), j => validarDesglose(j, grupo, datos.universo), { control, aviso, etiqueta }));
    } catch (e) {
      // Si no cupo en el tiempo con varias escenas, se reintenta de una en una.
      if (e.tipo !== 'tiempo' || grupo.length === 1) throw e;
      resultado = {};
      for (const escena of grupo) {
        const r = await pedirValidado(promptDesglose(datos, [escena]), j => validarDesglose(j, [escena], datos.universo), { control, aviso, etiqueta: `Desglose de la escena ${escena.id}` });
        Object.assign(resultado, r.resultado);
      }
    }
    for (const escena of grupo) {
      // Un desglose nuevo sustituye al anterior; sus imágenes se conservan
      // aparte por si se quieren recuperar.
      if (escena.planos?.length) escena.planosAnteriores = escena.planos;
      escena.planos = resultado[escena.id].map((p, n) => ({ ...p, id: `${escena.id}-${n + 1}` }));
    }
    hechas += grupo.length;
    await guardar?.();
    alAvanzar?.();
    // Revisión de puesta en escena cada 5 escenas (y al final lo que quede).
    porRevisar.push(...grupo);
    while (porRevisar.length >= REVISAR_CADA) {
      const resto = porRevisar.slice(REVISAR_CADA);
      porRevisar = porRevisar.slice(0, REVISAR_CADA);
      await revisarLo();
      porRevisar = resto;
    }
    if (g === grupos.length - 1 && porRevisar.length) await revisarLo();
  }
  return informe;
}

// El director de arte. Devuelve qué revisó de verdad.
export async function revisar(datos, escenas, { control, aviso, guardar }) {
  aviso?.('El director de arte revisa la puesta en escena…');
  const json = parsearJSON(await pedirTexto(promptRevision(datos, escenas), { control, aviso }));
  const revisadas = new Set((Array.isArray(json?.revisadas) ? json.revisadas : []).map(String));
  let correcciones = 0;
  for (const c of Array.isArray(json?.correcciones) ? json.correcciones : []) {
    const escena = escenas.find(e => e.id === String(c?.escena));
    const plano = escena?.planos?.[Number(c?.plano) - 1];
    const nuevo = String(c?.prompt || '').trim();
    if (!plano || nuevo.length < 40 || nuevo === plano.prompt) continue;
    plano.promptAnterior = plano.prompt;
    plano.prompt = nuevo;
    plano.revision = String(c?.motivo || '').trim();
    // No se borra nada: lo ya generado queda marcado como obsoleto.
    if (plano.imagen) plano.imagenObsoleta = true;
    if (plano.video) plano.videoObsoleto = true;
    correcciones++;
  }
  for (const e of escenas) if (revisadas.has(e.id)) e.revisada = Date.now();
  await guardar?.();
  return { revisadas: escenas.filter(e => revisadas.has(e.id)).length, correcciones, sinRevisar: escenas.filter(e => !revisadas.has(e.id)).map(e => e.id) };
}
