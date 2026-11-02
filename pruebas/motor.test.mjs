// Pruebas del motor de guion con un modelo simulado (sin llamadas reales).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../estudio/guion.mjs';
import * as P from '../estudio/prompts.mjs';
import { pedirTexto, crearControl, parsearJSON } from '../estudio/texto.mjs';

const formulario = { publico: 'masculino', genero: 'transmigracion', subgeneros: ['revenge', 'ecchi'], formato: '9:16', duracion: 3, cierre: 'completo', concepto: '' };

const universoCrudo = {
  titulo: 'El Boticario del Emperador', gancho: 'Murió en la farmacia y despertó como el hijo despreciado',
  premisa: 'Un farmacéutico moderno despierta en el cuerpo de un heredero humillado.', mundo: 'China antigua, ciudad amurallada.',
  reglas: ['La familia manda', 'El oro compra todo'], ventaja: 'Sabe medicina moderna', tieneSistema: true,
  sistema: { nombre: 'Sistema', reglaDelJuego: 'x' },
  personajes: [
    { nombre: 'Lin Feng', edad: 24, rol: 'protagonista', aspecto: 'pelo negro corto', appearance: 'short black hair' },
    { nombre: 'Wang Hu', edad: 30, rol: 'antagonista', aspecto: 'barba', appearance: 'beard' },
  ],
  escenarios: [
    { nombre: 'Patio de la mansión', descripcion: 'Exterior. Patio de piedra.', description: 'Exterior. Stone courtyard.' },
    { nombre: 'Botica', descripcion: 'Interior. Estantes de hierbas.', description: 'Interior. Herb shelves.' },
  ],
};

function universoValido() {
  return G.validarUniverso(universoCrudo, formulario).universo;
}

// Un bloque que cumple todo: ~430 palabras, frases cortas, dos ciclos con citas.
function bloqueValido({ apertura = true, palabras = 430 } = {}) {
  const lineas = [
    { tipo: 'dialogo', personaje: 'c2', texto: '¡Arrodíllate, inútil! Hoy pagas la deuda de tu padre.' },
    { tipo: 'pensamiento', personaje: 'c1', texto: 'Esa herida está infectada. Yo sé curarla mejor que nadie aquí.' },
    { tipo: 'dialogo', personaje: 'c1', texto: 'Tu hijo tiene fiebre. Si no lo curo, muere esta noche.' },
    { tipo: 'dialogo', personaje: 'c2', texto: 'Imposible. Ningún médico de la ciudad pudo bajarle la fiebre.' },
    { tipo: 'dialogo', personaje: 'extra', nombre: 'Criado', texto: 'Señor, el niño ya respira tranquilo. La fiebre bajó.' },
    { tipo: 'dialogo', personaje: 'c2', texto: 'No puede ser. Ese inútil lo salvó delante de todos.' },
    { tipo: 'dialogo', personaje: 'c2', texto: 'Toma esta bolsa de oro. La deuda queda perdonada.' },
  ];
  const relleno = 'Lo vi con mis propios ojos y no lo creo todavía.';
  const escenas = [{ titulo: 'La deuda', escenario: 'l1', personajes: ['c1', 'c2'], accion: 'Wang Hu empuja a Lin Feng contra el suelo del patio.', lineas: lineas.slice(0, 4) },
    { titulo: 'La cura', escenario: 'l2', personajes: ['c1', 'c2'], accion: 'Lin Feng mezcla hierbas junto al niño enfermo. La criada se inclina a su lado con la blusa empapada.', lineas: lineas.slice(4) }];
  let total = escenas.flatMap(e => e.lineas).reduce((n, l) => n + G.contarPalabras(l.texto), 0);
  let k = 0;
  while (total < palabras) {
    escenas[1].lineas.push({ tipo: 'dialogo', personaje: k % 2 ? 'c2' : 'c1', texto: relleno });
    total += G.contarPalabras(relleno); k++;
  }
  const json = {
    escenas,
    ciclos: [
      { problema: 'deuda', solucion: 'cura', reaccion: 'asombro', recompensa: 'oro', citaProblema: 'Hoy pagas la deuda de tu padre', citaReaccion: 'Ese inútil lo salvó delante de todos', citaRecompensa: 'La deuda queda perdonada' },
      { problema: 'fiebre', solucion: 'hierbas', reaccion: 'incredulidad', recompensa: 'respeto', citaProblema: 'Tu hijo tiene fiebre. Si no lo curo', citaReaccion: 'No puede ser. Ese inútil lo salvó', citaRecompensa: 'Toma esta bolsa de oro' },
    ],
    resumen: 'Lin Feng cura al hijo de Wang Hu.',
    huellas: [
      { de: 'genero', cita: 'Yo sé curarla mejor que nadie aquí' },
      { de: 'revenge', cita: 'Hoy pagas la deuda de tu padre' },
      { de: 'ecchi', cita: 'La criada se inclina a su lado con la blusa empapada' },
    ],
  };
  if (apertura) json.apertura = { citaConflicto: '¡Arrodíllate, inútil! Hoy pagas la deuda', citaElemento: 'Yo sé curarla mejor que nadie aquí' };
  return json;
}

const ctx = (extra = {}) => ({ universo: universoValido(), minimoPalabras: 392, ciclos: 2, esApertura: true, ...extra });

test('universo: ids propios, todos adultos y Sistema según la elección', () => {
  const { problemas, universo } = G.validarUniverso(universoCrudo, formulario);
  assert.deepEqual(problemas, []);
  assert.deepEqual(universo.personajes.map(p => p.id), ['c1', 'c2']);
  assert.equal(universo.tieneSistema, false, 'transmigración sin «sistema» en el concepto: no hay Sistema');
  assert.equal(universo.escenarios[1].interior, true);
  const menor = G.validarUniverso({ ...universoCrudo, personajes: [{ ...universoCrudo.personajes[0], edad: 17 }, universoCrudo.personajes[1]] }, formulario);
  assert.ok(menor.problemas.some(p => p.includes('no es adulto')));
  const conSistema = G.validarUniverso({ ...universoCrudo, sistema: { nombre: 'Sistema del Boticario', reglaDelJuego: 'Cura a diez personas' } }, { ...formulario, genero: 'sistema_juego' });
  assert.equal(conSistema.universo.tieneSistema, true);
});

test('bloque bueno: se acepta con sus dos ciclos demostrados', () => {
  const { problemas, bloque } = G.validarBloque(bloqueValido(), ctx());
  assert.deepEqual(problemas, []);
  assert.equal(bloque.ciclos.length, 2);
  assert.ok(bloque.palabras >= 392);
});

test('bloques malos: narrador, corto, sin ciclos, Sistema indebido, prosa de IA, escena vacía', () => {
  const casos = [
    [b => { b.escenas[0].lineas.unshift({ tipo: 'narrador', texto: 'Era una noche oscura.' }); }, 'narrador'],
    [b => { b.escenas[1].lineas = b.escenas[1].lineas.slice(0, 3); }, 'demasiado corto'],
    [b => { b.ciclos = [b.ciclos[0]]; }, 'hacen falta 2'],
    [b => { b.ciclos[0].citaReaccion = 'esto no aparece en ningún sitio del texto'; }, 'hacen falta 2'],
    [b => { b.escenas[0].lineas.push({ tipo: 'sistema', personaje: null, texto: 'Misión cumplida.' }); }, 'NO tiene Sistema'],
    [b => { b.escenas[0].lineas.push({ tipo: 'dialogo', personaje: 'c2', texto: 'Como si el tiempo se hubiera detenido.' }); }, 'suena a IA'],
    [b => { b.escenas[0].lineas.push({ tipo: 'dialogo', personaje: 'c2', texto: 'Durante los días siguientes entrenó.' }); }, 'resumen escolar'],
    [b => { b.escenas.push({ titulo: 'Vacía', escenario: 'l1', accion: 'Nada.', lineas: [] }); }, 'vacía'],
    [b => { b.escenas[0].lineas.push({ tipo: 'pensamiento', personaje: 'c2', texto: 'Lo odio.' }); }, 'no es el protagonista'],
    [b => {
      b.escenas[1].lineas.push({ tipo: 'dialogo', personaje: 'c1', texto: 'Al final del día ya nadie se atrevía a despreciarme.' });
      b.apertura.citaElemento = 'ya nadie se atrevía a despreciarme';
    }, '30 segundos'],
  ];
  for (const [romper, esperado] of casos) {
    const b = bloqueValido();
    romper(b);
    const { problemas } = G.validarBloque(b, ctx());
    assert.ok(problemas.some(p => p.includes(esperado)), `se esperaba «${esperado}» y salió: ${problemas.join(' | ')}`);
  }
});

test('plan: 3 minutos = 1 bloque con 2 ciclos; 30 minutos = 6 bloques', () => {
  const corto = P.planDelEpisodio(formulario);
  assert.equal(corto.length, 1);
  assert.equal(corto[0].ciclos, 2);
  assert.equal(corto[0].fase, 'unico');
  const largo = P.planDelEpisodio({ ...formulario, duracion: 30 });
  assert.equal(largo.length, 6);
  assert.equal(largo.reduce((n, b) => n + b.palabras, 0), 30 * P.PALABRAS_POR_MINUTO);
  assert.ok(largo.reduce((n, b) => n + b.ciclos, 0) >= 20, 'entre 20 y 40 ciclos en 30 minutos');
});

test('prompts: catálogo sin emojis, sin Sistema cuando no toca, dirección visual fuera del guion', () => {
  const p = P.promptIdeas(formulario);
  assert.match(p.mensaje, /Género principal: Transmigración/);
  assert.match(p.mensaje, /Venganza: motivada/);
  assert.match(p.mensaje, /NO tiene Sistema/);
  const familia = P.contextoEleccion({ ...formulario, publico: 'familia' });
  assert.doesNotMatch(familia, /Ecchi/, 'para toda la familia quita los subgéneros adultos');
  const datos = { formulario, universo: universoValido(), biblia: { direccionVisual: 'PALETA_SECRETA ocre', ritmoNarrativo: 'rápido' }, episodios: {} };
  const bloque = P.promptBloque(datos, 1, 0, P.planDelEpisodio(formulario));
  assert.doesNotMatch(bloque.mensaje, /PALETA_SECRETA/);
  assert.match(bloque.mensaje, /primeros 15 segundos/);
});

// ─── Con red simulada ───
let respuestas, llamadas, fetchOriginal;
beforeEach(() => {
  llamadas = []; respuestas = [];
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, cuerpo: JSON.parse(opciones.body || '{}') });
    const r = respuestas.shift();
    if (!r) throw new Error('llamada inesperada');
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado || 200 });
  };
});
afterEach(() => { globalThis.fetch = fetchOriginal; });
const texto = json => ({ cuerpo: { texto: JSON.stringify(json) } });

test('guion completo de 3 minutos: nota + bloque, se guarda cada paso', async () => {
  const datos = { formulario, universo: universoValido(), biblia: { direccionVisual: 'ocre', ritmoNarrativo: 'rápido' }, episodios: {} };
  respuestas = [
    texto({ objetivo: 'a', curvaEmocional: 'b', imagenClave: 'c', notaDeDireccion: 'd', quedaAbierto: '' }),
    texto(bloqueValido()),
  ];
  let guardados = 0;
  const ep = await G.escribirGuion(datos, 1, { guardar: async () => { guardados++; } });
  assert.equal(ep.estado, 'completo');
  assert.deepEqual(ep.bloques[0].escenas.map(e => e.id), ['e1', 'e2']);
  assert.ok(ep.segundos > 150);
  assert.ok(guardados >= 3);
});

test('un bloque rechazado se vuelve a pedir explicando por qué', async () => {
  const datos = { formulario, universo: universoValido(), biblia: { direccionVisual: 'ocre' }, episodios: { 1: { estado: 'escribiendo', plan: P.planDelEpisodio(formulario), bloques: [], nota: { objetivo: 'a' } } } };
  const corto = bloqueValido(); corto.escenas[1].lineas = corto.escenas[1].lineas.slice(0, 3);
  respuestas = [texto(corto), texto(bloqueValido())];
  await G.escribirGuion(datos, 1, {});
  assert.equal(llamadas.length, 2);
  assert.match(llamadas[1].cuerpo.mensaje, /REINTENTO OBLIGATORIO: .*demasiado corto/);
});

test('si no cabe en el tiempo, el bloque se parte en dos más pequeños', async () => {
  const datos = { formulario: { ...formulario, duracion: 30 }, universo: universoValido(), biblia: { direccionVisual: 'ocre' },
    episodios: { 1: { estado: 'escribiendo', plan: P.planDelEpisodio({ ...formulario, duracion: 30 }), bloques: [], nota: { objetivo: 'a' } } } };
  respuestas = [{ estado: 504, cuerpo: { error: 'tarde', tipo: 'tiempo' } }];
  await assert.rejects(G.escribirGuion(datos, 1, {}));   // tras partir, la siguiente llamada no tiene respuesta simulada
  const plan = datos.episodios[1].plan;
  assert.equal(plan.length, 7);
  assert.equal(plan[0].parte, 'primera mitad');
  assert.equal(plan[0].palabras + plan[1].palabras, 725);
});

test('un bloqueo de seguridad no se reintenta nunca', async () => {
  respuestas = [{ estado: 422, cuerpo: { error: 'Google bloqueó', tipo: 'bloqueo' } }];
  await assert.rejects(pedirTexto({ mensaje: 'x' }), e => e.tipo === 'bloqueo');
  assert.equal(llamadas.length, 1);
});

test('una cuota espera, y Detener corta la espera en el acto', async () => {
  respuestas = [{ estado: 429, cuerpo: { error: 'espera', tipo: 'cuota' } }];
  const control = crearControl();
  const avisos = [];
  const inicio = Date.now();
  setTimeout(() => control.detener(), 600);
  await assert.rejects(pedirTexto({ mensaje: 'x' }, { control, aviso: a => avisos.push(a) }), e => e.detenido);
  assert.ok(Date.now() - inicio < 3000, 'no espera los 20 s');
  assert.ok(avisos.some(a => /Reintento en 20 s/.test(a)));
});

test('el JSON con saltos de línea sin escapar se repara', () => {
  assert.deepEqual(parsearJSON('```json\n{"a":"uno\ndos"}\n```'), { a: 'uno\ndos' });
});

// ─── Desglose de planos ───
import * as D from '../estudio/desglose.mjs';

function escenaDePrueba() {
  const { bloque } = G.validarBloque(bloqueValido(), ctx());
  return { ...bloque.escenas[0], id: 'e1' };
}
function desgloseValido(escena) {
  const palabras = (escena.accion + ' ' + D.textoEscena(escena)).replace(/[«»"“”¿?¡!.,;:…—–()]/g, ' ').split(/\s+/).filter(Boolean);
  // Siete planos (si la escena los admite), para que la proporción 70/30 cuente.
  const n = Math.min(D.maximoPlanos(escena), Math.max(D.minimoPlanos(escena), 7));
  const paso = Math.floor((palabras.length - 4) / n);
  return { escenas: [{ id: escena.id, presentes: ['c1', 'c2'], planos: Array.from({ length: n }, (_, i) => ({
    tipo: i % 3 === 2 ? 'cobertura' : 'accion', encuadre: i === 0 ? 'general' : 'medio', ancla: palabras.slice(i * paso, i * paso + 4).join(' '),
    personajes: i === 0 ? ['c1', 'c2'] : ['c1'], entran: [], salen: [], peso: 3,
    estado: 'Lin Feng kneels on the stone floor of the courtyard; Wang Hu stands over him, two steps away.',
    cambio: i ? 'Lin Feng lifts his head a little more than in the previous shot.' : '',
    prompt: 'Scene with Lin Feng (short black hair, grey robe): medium shot, side view, kneeling in the stone courtyard at dawn.',
    movimiento: i % 3 !== 2 ? 'Lin Feng slowly raises his head.' : '', sistema: '' })) }] };
}

test('desglose: mínimos por palabras y por duración', () => {
  const e = escenaDePrueba();
  assert.ok(D.minimoPlanos(e) >= 3);
  assert.equal(D.minimoPlanos({ ...e, lineas: [{ tipo: 'dialogo', personaje: 'c1', texto: 'Sí.' }] }), 1);
  assert.ok(D.maximoPlanos(e) > D.minimoPlanos(e));
});

test('desglose bueno se acepta; anclas inventadas, desorden, pocos planos, mirar a cámara y proporción mala se rechazan', () => {
  const e = escenaDePrueba();
  const u = universoValido();
  assert.deepEqual(D.validarDesglose(desgloseValido(e), [e], u).problemas, []);
  const casos = [
    [j => { j.escenas[0].planos[0].ancla = 'esto no lo dijo nadie nunca'; }, 'no está copiada literalmente'],
    [j => { const p = j.escenas[0].planos; [p[0], p[2]] = [p[2], p[0]]; }, 'retrocede'],
    [j => { j.escenas[0].planos = j.escenas[0].planos.slice(0, 1); }, 'necesita al menos'],
    [j => { j.escenas[0].planos[1].prompt += ' He is looking at the camera.'; }, 'mira a cámara'],
    [j => { j.escenas[0].planos.forEach(p => { p.tipo = 'cobertura'; }); }, 'proporción'],
    [j => { j.escenas[0].planos[0].movimiento = ''; }, 'no dice qué movimiento'],
  ];
  for (const [romper, esperado] of casos) {
    const j = desgloseValido(e);
    romper(j);
    const { problemas } = D.validarDesglose(j, [e], u);
    assert.ok(problemas.some(p => p.includes(esperado)), `se esperaba «${esperado}»: ${problemas.join(' | ')}`);
  }
});

test('el director de arte corrige sin borrar: la imagen queda obsoleta y dice qué no revisó', async () => {
  const e = escenaDePrueba();
  e.planos = D.validarDesglose(desgloseValido(e), [e], universoValido()).resultado.e1.map((p, n) => ({ ...p, id: `e1-${n + 1}` }));
  e.planos[0].imagen = { ruta: 'x' };
  const e2 = { ...escenaDePrueba(), id: 'e2', planos: [] };
  const datos = { formulario, universo: universoValido(), biblia: {} };
  respuestas = [texto({ revisadas: ['e1'], correcciones: [{ escena: 'e1', plano: 1, prompt: 'Scene with Lin Feng (short black hair): kneeling on the stone floor, no table in this courtyard, dawn light.', motivo: 'había una mesa que el patio no tiene' }] })];
  const r = await D.revisar(datos, [e, e2], {});
  assert.equal(r.correcciones, 1);
  assert.equal(e.planos[0].imagenObsoleta, true);
  assert.equal(e.planos[0].imagen.ruta, 'x', 'no se borra nada');
  assert.deepEqual(r.sinRevisar, ['e2'], 'lo que no miró no se da por bueno');
});

test('desglose: las escenas se agrupan sin pasarse de 5 escenas ni de 24 planos por petición', () => {
  const corta = { ...escenaDePrueba(), lineas: [{ tipo: 'dialogo', personaje: 'c1', texto: 'Sí.' }] };
  const larga = { ...escenaDePrueba(), lineas: Array.from({ length: 40 }, () => ({ tipo: 'dialogo', personaje: 'c1', texto: 'Lo vi con mis propios ojos y no lo creo todavía.' })) };
  assert.deepEqual(D.agrupar(Array(7).fill(corta)).map(g => g.length), [5, 2]);
  const grupos = D.agrupar([corta, larga, corta]);
  assert.ok(grupos.every(g => g.length === 1 || g.reduce((n, e) => n + D.minimoPlanos(e), 0) <= 24));
  assert.equal(grupos.flat().length, 3);
});

// ─── Videos ───
import * as V from '../estudio/videos.mjs';

test('prompt de video: bloques literales en orden, encuadre bloqueado solo sin movimiento de cámara, escenario en una frase', () => {
  const u = universoValido();
  const interior = u.escenarios[1];
  const p = V.promptVideo({ movimiento: 'Lin Feng grinds herbs in the mortar.' }, interior);
  assert.ok(p.startsWith(V.ESTILO), 'el estilo va primero');
  assert.ok(p.endsWith(V.AUDIO), 'el audio sin voces va al final');
  const orden = [V.ESTILO, 'MOTION — CRITICAL: animate EXACTLY', V.ENCUADRE_BLOQUEADO, 'SETTING — already built into the input image, do not redesign it: Interior.', 'THIS SHOT IS INTERIOR', V.ACTUACION, 'SHOT MOTION: Lin Feng grinds herbs in the mortar.', V.AUDIO].map(t => p.indexOf(t));
  assert.ok(orden.every(i => i >= 0), 'están todos los bloques: ' + orden);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'y en su orden');
  assert.ok(!p.includes('Herb shelves'), 'del escenario solo la primera frase');
  const camara = V.promptVideo({ movimiento: 'The camera slowly pushes in on Lin Feng.' }, u.escenarios[0]);
  assert.ok(!camara.includes('FRAMING — LOCKED'), 'si el director pide cámara, no se le contradice');
  assert.ok(!camara.includes('THIS SHOT IS INTERIOR'));
  const negativo = V.negativoVideo({ movimiento: '' }, interior);
  assert.ok(!/\bno\b|\bdon't\b|\bnever\b/i.test(negativo), 'el negativo es una lista de cosas, sin órdenes');
  assert.match(negativo, /zoom in/);
  assert.match(negativo, /wet indoor floor/);
  assert.ok(!V.negativoVideo({ movimiento: 'camera pans left' }, interior).includes('whip pan'));
});

test('video: la operación se guarda en cuanto arranca, se sigue tras «recargar» y al terminar queda el clip', async () => {
  const datos = { formulario, universo: universoValido(), ajustes: { modeloVideo: 'veo-3.1-generate-001' } };
  const escena = { id: 'e1', escenario: 'l1' };
  const plano = { id: 'e1-1', tipo: 'accion', movimiento: 'Lin Feng stands up.', imagen: { ruta: 'r/plano-e1-1.png' } };
  const guardados = [];
  const guardar = async () => { guardados.push(JSON.parse(JSON.stringify(plano))); };
  respuestas = [{ cuerpo: { operacion: 'op/1', modelo: 'veo-3.1-generate-001', segundos: 4 } }, { cuerpo: { listo: false } }];
  // Primera vez: arranca, consulta una vez y se «recarga» (Detener).
  const control = crearControl();
  const avisos = [];
  setTimeout(() => control.detener(), 700);
  await assert.rejects(V.videoPlano({ proyectoId: 'pabc12345', datos, escena, plano, control, guardar, cada: 0.5, aviso: a => avisos.push(a) }), e => e.detenido);
  assert.equal(llamadas[0].url, '/api/video-inicio');
  assert.equal(llamadas[0].cuerpo.modelo, 'veo-3.1-generate-001');
  assert.equal(llamadas[0].cuerpo.clave, 'video-e1-1');
  assert.equal(llamadas[0].cuerpo.imagen, 'r/plano-e1-1.png');
  assert.equal(guardados[0].operacion.nombre, 'op/1', 'la operación se guarda antes de esperar');
  assert.equal(plano.operacion.nombre, 'op/1', 'Detener no tira la operación');
  // Segunda vez: no arranca otra, sigue la misma.
  llamadas = [];
  respuestas = [{ cuerpo: { listo: true, ruta: 'r/video-e1-1/9/sample_0.mp4', url: 'https://firmada', modelo: 'veo-3.1-generate-001' } }];
  const video = await V.videoPlano({ proyectoId: 'pabc12345', datos, escena, plano, control: crearControl(), guardar, cada: 0.25 });
  assert.deepEqual(llamadas.map(l => l.url), ['/api/video-estado']);
  assert.equal(llamadas[0].cuerpo.operacion, 'op/1');
  assert.equal(video.ruta, 'r/video-e1-1/9/sample_0.mp4');
  assert.equal(plano.operacion, undefined);
  assert.equal(guardados.at(-1).video.ruta, 'r/video-e1-1/9/sample_0.mp4');
});

test('video: un bloqueo cierra la operación sin reintentar; sin imagen no se arranca', async () => {
  const datos = { formulario, universo: universoValido() };
  const plano = { id: 'e1-2', tipo: 'accion', movimiento: 'x', imagen: { ruta: 'r/p.png' }, operacion: { nombre: 'op/2', inicio: Date.now() } };
  respuestas = [{ estado: 422, cuerpo: { error: 'Google bloqueó este video', tipo: 'bloqueo' } }];
  await assert.rejects(V.videoPlano({ proyectoId: 'pabc12345', datos, escena: { id: 'e1', escenario: 'l1' }, plano, control: crearControl(), guardar: async () => {}, cada: 0.25 }), e => e.tipo === 'bloqueo');
  assert.equal(llamadas.length, 1);
  assert.equal(plano.operacion, undefined, 'se puede arrancar otro después de cambiar el plano');
  await assert.rejects(V.videoPlano({ proyectoId: 'pabc12345', datos, escena: { id: 'e1', escenario: 'l1' }, plano: { id: 'e1-3' }, guardar: async () => {} }), /genérala primero/);
  assert.equal(llamadas.length, 1);
});


// ─── Géneros, subgéneros y ecchi en todo el recorrido ───
import * as I from '../estudio/imagenes.mjs';

test('cada bloque demuestra con una cita el género y cada subgénero elegido', () => {
  const huellas = P.huellasPedidas(formulario);
  assert.deepEqual(huellas.map(h => h.clave), ['genero', 'revenge', 'ecchi']);
  assert.deepEqual(G.validarBloque(bloqueValido(), ctx({ huellas })).problemas, []);
  const sinEcchi = bloqueValido();
  sinEcchi.huellas = sinEcchi.huellas.filter(h => h.de !== 'ecchi');
  assert.ok(G.validarBloque(sinEcchi, ctx({ huellas })).problemas.some(p => p.includes('fan service')));
  const inventada = bloqueValido();
  inventada.huellas[1].cita = 'una venganza que no aparece en el texto';
  assert.ok(G.validarBloque(inventada, ctx({ huellas })).problemas.some(p => p.includes('Revenge')));
  // Con «Para toda la familia» el ecchi no se pide.
  assert.deepEqual(P.huellasPedidas({ ...formulario, publico: 'familia' }).map(h => h.clave), ['genero', 'revenge']);
});

test('el ecchi y el reparto atractivo llegan al universo, al guion y a cada imagen', () => {
  const universo = P.promptUniverso(formulario, { titulo: 'x', concepto: 'y' }).mensaje;
  assert.ok(universo.includes(P.REPARTO_ATRACTIVO));
  assert.ok(universo.includes('MODIFICADOR ECCHI ACTIVO'));
  assert.match(universo, /"sexo": "mujer \| hombre"/);
  const familia = { ...formulario, publico: 'familia' };
  assert.ok(!P.promptUniverso(familia, { titulo: 'x', concepto: 'y' }).mensaje.includes('MODIFICADOR ECCHI'));
  assert.ok(P.contextoEleccion(formulario).includes(P.REGLA_DE_CAPAS));
  const datos = { formulario, universo: universoValido(), biblia: {}, episodios: { 1: { bloques: [] } } };
  assert.ok(P.promptBloque(datos, 1, 0, P.planDelEpisodio(formulario)).mensaje.includes('REGLAS ECCHI'));
  const aspecto = I.direccionDeAspecto(formulario);
  assert.ok(aspecto.includes(I.CASTING) && aspecto.includes(I.ASPECTO_GENERO.transmigracion) && aspecto.includes(I.ASPECTO_SUBGENERO.revenge) && aspecto.includes(I.ECCHI_VISUAL));
  assert.ok(!I.direccionDeAspecto(familia).includes(I.ECCHI_VISUAL));
  const ficha = I.promptFichaPersonaje({ nombre: 'Mei', sexo: 'mujer', edad: 24, rol: 'interés amoroso', appearance: 'long black hair, red silk dress' }, formulario);
  assert.match(ficha, /stunningly beautiful adult woman with the idol-like look/);
  assert.match(ficha, /curvy, alluring figure/);
  assert.ok(!I.promptFichaPersonaje({ nombre: 'Mei', sexo: 'mujer', edad: 24, appearance: 'x' }, familia).includes('curvy'));
  assert.equal(G.validarUniverso({ ...universoCrudo, personajes: [{ ...universoCrudo.personajes[0], sexo: 'hombre' }, { ...universoCrudo.personajes[1], sexo: 'Mujer' }] }, formulario).universo.personajes[1].sexo, 'mujer');
});

test('ficha: un personaje antiguo sin sexo guardado se reconoce por su aspecto en español', () => {
  const ficha = I.promptFichaPersonaje({ nombre: 'Mei', edad: 24, aspecto: 'Mujer de pelo largo negro, vestido rojo de seda', appearance: 'long black hair, red silk dress' }, formulario);
  assert.match(ficha, /stunningly beautiful adult woman with the idol-like look/);
  assert.match(ficha, /curvy, alluring figure/);
});


test('continuidad de escena: nadie aparece ni desaparece por arte de magia y cada plano dice quién está y qué cambió', () => {
  const e = escenaDePrueba();
  const u = universoValido();
  const bueno = D.validarDesglose(desgloseValido(e), [e], u);
  assert.deepEqual(bueno.problemas, []);
  assert.deepEqual(bueno.presentes.e1, ['c1', 'c2']);
  assert.deepEqual(bueno.resultado.e1[1].presentes, ['c1', 'c2'], 'cada plano sabe quién está, aunque no se vea');
  const casos = [
    [j => { j.escenas[0].presentes = ['c1']; }, 'sin estar en la escena'],
    [j => { j.escenas[0].presentes = ['c1']; j.escenas[0].planos[0].personajes = ['c1']; }, 'habla Wang Hu pero no está'],
    [j => { j.escenas[0].planos[0].personajes = ['c1']; }, 'deja fuera a Wang Hu'],
    [j => { j.escenas[0].planos[0].encuadre = 'medio'; }, 'primer plano tiene que ser general'],
    [j => { j.escenas[0].planos[2].estado = 'Lin Feng kneels on the floor, head down, breathing hard.'; }, 'no dice dónde está Wang Hu'],
    [j => { j.escenas[0].planos[3].cambio = ''; }, 'no dice en "cambio"'],
    [j => { j.escenas[0].planos[1].encuadre = 'cualquiera'; }, 'no dice su encuadre'],
    [j => { j.escenas[0].planos[1].salen = ['c2']; j.escenas[0].planos[3].personajes = ['c1', 'c2']; }, 'sin estar en la escena'],
  ];
  for (const [romper, esperado] of casos) {
    const j = desgloseValido(e);
    romper(j);
    const { problemas } = D.validarDesglose(j, [e], u);
    assert.ok(problemas.some(p => p.includes(esperado)), `se esperaba «${esperado}»: ${problemas.join(' | ')}`);
  }
  // Quien entra más tarde: se apunta en el plano en que entra y desde ahí está.
  const entra = desgloseValido(e);
  entra.escenas[0].presentes = ['c1'];
  entra.escenas[0].planos[0] = { ...entra.escenas[0].planos[0], personajes: ['c1'], estado: 'Lin Feng kneels alone on the stone floor of the courtyard.' };
  entra.escenas[0].planos[1].entran = ['c2'];
  entra.escenas[0].planos[1].personajes = ['c1', 'c2'];
  const r = D.validarDesglose(entra, [e], u);
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.resultado.e1[0].presentes, ['c1']);
  assert.deepEqual(r.resultado.e1[1].presentes, ['c1', 'c2']);
});

test('el director de arte puede corregir el estado y el cambio de un plano, y ve quién está en la escena', async () => {
  const e = escenaDePrueba();
  const r0 = D.validarDesglose(desgloseValido(e), [e], universoValido());
  e.planos = r0.resultado.e1.map((p, n) => ({ ...p, id: `e1-${n + 1}` }));
  e.presentes = r0.presentes.e1;
  e.planos[1].imagen = { ruta: 'x' };
  const datos = { formulario, universo: universoValido(), biblia: {} };
  assert.match(D.promptRevision(datos, [e]).mensaje, /presentes al empezar: Lin Feng, Wang Hu/);
  respuestas = [texto({ revisadas: ['e1'], correcciones: [{ escena: 'e1', plano: 2, estado: 'Lin Feng kneels on the floor; Wang Hu now stands right behind him, a hand on his shoulder.', motivo: 'Wang Hu desaparecía sin haber salido' }] })];
  const r = await D.revisar(datos, [e], {});
  assert.equal(r.correcciones, 1);
  assert.match(e.planos[1].estado, /Wang Hu now stands right behind him/);
  assert.equal(e.planos[1].imagenObsoleta, true);
});

import { pedirMedio } from '../estudio/medios.mjs';
test('medios: la espera dice el motivo real y un corte por tiempo no se repite solo', async () => {
  respuestas = [{ estado: 502, cuerpo: { error: 'Google no generó la imagen (código 503).', tipo: 'google', detalleGoogle: '503 — The model is overloaded.' } }, { cuerpo: { ruta: 'r/x.png' } }];
  const avisos = [];
  const r = await pedirMedio('/api/imagen', { a: 1 }, { control: crearControl(), aviso: a => avisos.push(a) });
  assert.equal(r.ruta, 'r/x.png');
  assert.ok(avisos.some(a => /Google está saturado ahora mismo \(código 503\)\. Se vuelve a intentar\. Reintento en/.test(a)), avisos.join(' | '));
  assert.ok(!avisos.some(a => /corte pasajero/.test(a)));
  llamadas = [];
  respuestas = [{ estado: 504, cuerpo: { error: 'Google tardó más de 47 s', tipo: 'tiempo' } }];
  await assert.rejects(pedirMedio('/api/imagen', { a: 1 }, { control: crearControl() }), e => e.tipo === 'tiempo');
  assert.equal(llamadas.length, 1, 'no se paga dos veces');
});

test('video: el audio prohíbe también gritos y jadeos, y el negativo los lista', () => {
  const u = universoValido();
  const p = V.promptVideo({ movimiento: 'Lin Feng shouts at the guard.' }, u.escenarios[0]);
  assert.ok(p.endsWith(V.AUDIO));
  assert.match(V.AUDIO, /^AUDIO: NO voice dialogue, NO narration, NO singing, NO human speech of any kind\. ONLY the diegetic sound of this shot/);
  assert.match(V.AUDIO, /no screams, shouts, yells, gasps/);
  const n = V.negativoVideo({ movimiento: '' }, u.escenarios[0]);
  assert.match(n, /screaming, shouting/);
  assert.match(n, /see-through clothing/);
});

test('lugares: el director escribe una ficha detallada en inglés de cada lugar y va completa en cada plano', async () => {
  const datos = { formulario, universo: universoValido(), biblia: { direccionVisual: 'ocre' } };
  const larga = n => Array.from({ length: n }, (_, i) => `the stone item ${i} with old wood`).join(', ');
  respuestas = [
    texto({ lugares: [{ id: 'l1', ficha: 'corta' }, { id: 'l2', ficha: larga(30) }] }),
    texto({ lugares: [{ id: 'l1', ficha: larga(30) }, { id: 'l2', ficha: larga(30) }] }),
  ];
  let guardados = 0;
  assert.equal(await G.asegurarLugares(datos, { guardar: async () => { guardados++; } }), 2);
  assert.match(llamadas[1].cuerpo.mensaje, /REINTENTO OBLIGATORIO.*demasiado corta/);
  assert.ok(datos.universo.escenarios.every(e => e.ficha.length > 200));
  assert.equal(guardados, 1);
  assert.equal(await G.asegurarLugares(datos, {}), 0, 'lo que ya tiene ficha no se repite');
  assert.ok(I.textoDelLugar(datos.universo.escenarios[0]).includes(datos.universo.escenarios[0].ficha));
  assert.match(D.promptDesglose({ ...datos, episodios: {} }, [{ ...escenaDePrueba(), id: 'e1' }]).mensaje, /LUGARES \(ficha de cada uno/);
});

// ─── Voces, música, subtítulos, montaje y episodios ───
import * as VZ from '../estudio/voces.mjs';
import * as MU from '../estudio/musica.mjs';
import * as SU from '../estudio/subtitulos.mjs';
import * as MO from '../estudio/montaje.mjs';

const VOCES = [{ nombre: 'Charon', genero: 'hombre' }, { nombre: 'Kore', genero: 'mujer' }, { nombre: 'Puck', genero: 'hombre' }, { nombre: 'Leda', genero: 'mujer' }];

test('voces: cada personaje recibe una voz distinta según su sexo y la escena se parte en tramos de dos voces como mucho', () => {
  const u = universoValido();
  u.personajes[0].sexo = 'hombre'; u.personajes[1].sexo = 'mujer';
  u.tieneSistema = true;
  assert.equal(VZ.asignarVoces(u, VOCES), true);
  assert.equal(VOCES.find(v => v.nombre === u.personajes[0].voz).genero, 'hombre');
  assert.equal(VOCES.find(v => v.nombre === u.personajes[1].voz).genero, 'mujer');
  assert.ok(u.vozSistema && u.vozSistema !== u.personajes[0].voz && u.vozSistema !== u.personajes[1].voz);
  assert.equal(VZ.asignarVoces(u, VOCES), false, 'una voz asignada no se cambia sola');
  const escena = { lineas: [
    { tipo: 'dialogo', personaje: 'c1', texto: 'Uno.' }, { tipo: 'dialogo', personaje: 'c2', texto: 'Dos.' },
    { tipo: 'pensamiento', personaje: 'c1', texto: 'Tres.' }, { tipo: 'sistema', personaje: null, texto: 'Misión.' },
    { tipo: 'dialogo', personaje: 'extra', nombre: 'Criado', texto: 'Señor.' }] };
  VZ.asignarExtras(u, [escena], VOCES);
  const tramos = VZ.tramosDeEscena(escena, u);
  assert.ok(tramos.every(t => t.voces.length <= 2));
  assert.deepEqual(tramos.map(t => t.lineas.map(l => l.indice)), [[0, 1, 2], [3, 4]]);
  assert.equal(tramos[0].lineas[2].pensamiento, true);
});

test('voces: la escena entera se genera por tramos y solo se guarda cuando están todos', async () => {
  const datos = { formulario, universo: universoValido(), ajustes: { registroVoz: 'dramatica' } };
  datos.universo.personajes[0].sexo = 'hombre'; datos.universo.personajes[1].sexo = 'mujer';
  const escena = { id: 'e1', lineas: [{ tipo: 'dialogo', personaje: 'c1', texto: 'Hola.' }, { tipo: 'dialogo', personaje: 'c2', texto: 'Adiós.' }] };
  respuestas = [{ cuerpo: { voces: VOCES } }, { cuerpo: { ruta: 'r/voz-e1-1.wav', url: 'u', segundos: 2.4 } }];
  let guardados = 0;
  await VZ.vozEscena({ proyectoId: 'pabc12345', datos, escena, control: crearControl(), guardar: async () => { guardados++; } });
  assert.equal(llamadas[1].url, '/api/voz');
  assert.equal(llamadas[1].cuerpo.registro, 'dramatica');
  assert.equal(llamadas[1].cuerpo.hablantes.length, 2);
  assert.equal(llamadas[1].cuerpo.clave, 'voz-e1-1');
  assert.deepEqual(escena.voz.tramos, [{ ruta: 'r/voz-e1-1.wav', segundos: 2.4, lineas: [0, 1] }]);
  assert.ok(guardados >= 1);
});

test('subtítulos: el texto del guion con los tiempos reales; si casa poco, reparto proporcional; frases cortas', () => {
  const t = SU.alinearTramo(['Arrodíllate, inútil.', 'Nunca lo haré.'], [
    { palabra: 'arrodíllate', inicio: 0.1, fin: 0.8 }, { palabra: 'inútil', inicio: 0.9, fin: 1.4 },
    { palabra: 'nunca', inicio: 2.0, fin: 2.3 }, { palabra: 'lo', inicio: 2.3, fin: 2.4 }, { palabra: 'haré', inicio: 2.4, fin: 2.9 }], 3.2);
  assert.deepEqual(t.map(x => [x.inicio, x.fin, x.metodo]), [[0.1, 1.4, 'alineado'], [2.0, 2.9, 'alineado']]);
  const p = SU.alinearTramo(['Uno dos tres.', 'Cuatro.'], [], 4);
  assert.deepEqual(p.map(x => [x.inicio, x.fin]), [[0, 3], [3, 4]]);
  const frases = SU.frasesDeLinea('Hoy pagas la deuda. ¿Me oyes?', 1, 3);
  assert.deepEqual(frases.map(f => f.texto), ['Hoy pagas la deuda.', '¿Me oyes?']);
  assert.equal(frases[0].inicio, 1);
  assert.ok(Math.abs(frases.at(-1).fin - 3) < 1e-9);
});

test('música: un acto por bloque (la prueba de 3 min se parte en dos) y el brief tiene que estar en inglés', () => {
  const ep = { bloques: [{ escenas: [{ id: 'e1', titulo: 'a', accion: 'x', lineas: [{ texto: 'uno dos' }] }, { id: 'e2', titulo: 'b', accion: 'y', lineas: [{ texto: 'tres' }] }] }] };
  const actos = MU.actosDelEpisodio(ep);
  assert.deepEqual(actos.map(a => a.escenas), [['e1'], ['e2']]);
  const r = MU.validarMusica({ pistas: [{ acto: 1, brief: 'Tense score with taiko drums, guzheng and low strings, slow tempo, rising toward a confrontation.' }, { acto: 2, brief: 'Música épica con tambores, cuerdas graves y metales que crecen poco a poco hacia el triunfo final del protagonista en la plaza.' }] }, actos);
  assert.ok(r.briefs[1]);
  assert.ok(r.problemas.some(p => p.includes('español')));
});

test('montaje: cada escena dura su narración, los planos se reparten por peso, voces y música en su instante, sin duplicar el Sistema', () => {
  const datos = { formulario, universo: universoValido(), episodios: { 1: { estado: 'completo', musica: { 1: { ruta: 'r/m1.wav', brief: 'x' } }, bloques: [{ escenas: [
    { id: 'e1', titulo: 'La deuda', lineas: [{ tipo: 'dialogo', personaje: 'c1', texto: 'Hola. ¿Me oyes?' }, { tipo: 'sistema', personaje: null, texto: 'Misión cumplida.' }],
      voz: { tramos: [{ ruta: 'r/v1.wav', segundos: 2, lineas: [0], tiempos: [{ inicio: 0.1, fin: 1.9 }] }, { ruta: 'r/v2.wav', segundos: 1, lineas: [1] }] },
      planos: [{ peso: 3, tipo: 'accion', imagen: { ruta: 'r/p1.png' }, video: { ruta: 'r/p1.mp4' }, sistema: 'Misión cumplida.' }, { peso: 1, tipo: 'cobertura', imagen: { ruta: 'r/p2.png' } }] },
  ] }] } } };
  const h = MO.hojaDeVideo(datos, 1);
  const D = MO.ENTRADA + 2 + MO.PAUSA + 1 + MO.COLA;
  assert.ok(Math.abs(h.planos.reduce((n, p) => n + p.duracion, 0) - D) < 0.01, 'la escena dura su narración');
  assert.deepEqual(h.planos.map(p => p.tipo), ['video', 'imagen']);
  assert.ok(h.planos[0].duracion > h.planos[1].duracion, 'el peso manda');
  assert.equal(h.planos[0].sistema, 'Misión cumplida.');
  assert.deepEqual(h.voces.map(v => v.inicio), [MO.ENTRADA, Number((MO.ENTRADA + 2 + MO.PAUSA).toFixed(3))]);
  assert.deepEqual(h.subtitulos.map(s => s.texto), ['Hola.', '¿Me oyes?'], 'el panel del Sistema no se repite abajo');
  assert.equal(h.subtitulos[0].inicio, Number((MO.ENTRADA + 0.1).toFixed(3)));
  assert.equal(h.musica.length, 1);
  assert.equal(h.musica[0].inicio, 0);
  // Sin imagen o sin voz no se monta, y se dice qué falta.
  datos.episodios[1].bloques[0].escenas[0].planos[1].imagenObsoleta = true;
  assert.throws(() => MO.hojaDeVideo(datos, 1), /Falta la imagen del plano 2/);
  const zip = MO.hojaDeZip(datos, 1);
  assert.ok(zip.archivos.some(a => a.nombre === 'videos/escena-01-plano-01.mp4'));
  assert.ok(zip.archivos.some(a => a.nombre === 'musica/acto-1.wav'));
  assert.ok(zip.textos.some(t => t.nombre === 'guion.txt' && /ESCENA 1 — La deuda/.test(t.contenido)));
});

test('episodios encadenados: el episodio 2 conoce lo que pasó y sus escenas tienen ids propios (no hereda medios)', async () => {
  const datos = { formulario, universo: universoValido(), biblia: { direccionVisual: 'ocre', ritmoNarrativo: 'rápido' }, episodioActual: 2, episodios: {
    1: { estado: 'completo', nota: { quedaAbierto: 'el padre sigue preso' }, bloques: [{ resumen: 'Lin Feng cura al hijo de Wang Hu.', escenas: [] }] } } };
  const p = P.promptNota(datos, 2).mensaje;
  assert.match(p, /LO QUE YA PASÓ EN LOS EPISODIOS ANTERIORES/);
  assert.match(p, /Episodio 1: Lin Feng cura al hijo de Wang Hu\. Quedó abierto: el padre sigue preso/);
  respuestas = [texto({ objetivo: 'a', curvaEmocional: 'b', imagenClave: 'c', notaDeDireccion: 'd', quedaAbierto: '' }), texto(bloqueValido())];
  const ep = await G.escribirGuion(datos, 2, { guardar: async () => {} });
  assert.match(llamadas[1].cuerpo.mensaje, /LO QUE YA PASÓ EN LOS EPISODIOS ANTERIORES/);
  assert.deepEqual(ep.bloques[0].escenas.map(e => e.id), ['ep2e1', 'ep2e2']);
});

test('montaje: los planos nunca bajan del mínimo; si no caben, la escena se alarga lo justo', () => {
  const r = MO.repartir([3, 1, 1], 6);
  assert.ok(Math.abs(r.durs.reduce((a, b) => a + b, 0) - 6) < 1e-9);
  assert.ok(r.durs[0] > r.durs[1]);
  const apretado = MO.repartir(Array(10).fill(1).concat([20]), 3);
  assert.ok(apretado.durs.every(d => d >= MO.MINIMO_PLANO - 1e-9));
  assert.equal(apretado.total, 11 * MO.MINIMO_PLANO);
  const u = universoValido();
  assert.equal(I.sexoDe({ appearance: 'a tall young man with short hair' }), 'hombre');
  assert.equal(I.sexoDe({ aspecto: 'Mujer de pelo largo' }), 'mujer');
  assert.equal(I.sexoDe({ appearance: 'short black hair' }), '');
});
