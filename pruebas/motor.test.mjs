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
    { titulo: 'La cura', escenario: 'l2', personajes: ['c1', 'c2'], accion: 'Lin Feng mezcla hierbas junto al niño enfermo.', lineas: lineas.slice(4) }];
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
