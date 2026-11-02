// Pruebas del servidor: acceso privado, puerta y salud.
// Sin cuentas reales: Google se sustituye por respuestas simuladas.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync, sign } = require('node:crypto');

const RAIZ = path.resolve(__dirname, '..');
const acceso = require('../api/_lib/acceso');
const errores = require('../api/_lib/errores');
const puerta = require('../api/_lib/puerta');
const google = require('../api/_lib/google');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const claveServicio = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const firebase = { projectId: 'drama-prueba', apiKey: 'clave-publica', authDomain: 'drama-prueba.firebaseapp.com', appId: 'app-prueba' };
const ahora = () => Math.floor(Date.now() / 1000);
const carga = cambios => ({ sub: 'dueno-id', aud: firebase.projectId, iss: 'https://securetoken.google.com/' + firebase.projectId,
  iat: ahora() - 2, exp: ahora() + 3600, auth_time: ahora() - 20, email: 'dueno@example.com', email_verified: true,
  firebase: { sign_in_provider: 'google.com' }, ...cambios });
function token(cambios, cabecera = {}) {
  const partes = [{ alg: 'RS256', kid: 'prueba', ...cabecera }, carga(cambios)].map(x => Buffer.from(JSON.stringify(x)).toString('base64url'));
  const datos = partes.join('.');
  return datos + '.' + sign('RSA-SHA256', Buffer.from(datos), privateKey).toString('base64url');
}

let llamadas, cuenta, fetchOriginal, entornoOriginal, google_responde;
function fetchFalso(url, opciones) {
  url = String(url);
  llamadas.push({ url, opciones });
  if (url === acceso.CERTIFICADOS) {
    return Promise.resolve(new Response(JSON.stringify({ prueba: publicKey.export({ type: 'spki', format: 'pem' }) }), { headers: { 'Cache-Control': 'public, max-age=600' } }));
  }
  if (url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup')) {
    return Promise.resolve(new Response(JSON.stringify({ users: [cuenta] })));
  }
  if (google_responde) return google_responde(url, opciones);
  throw new Error('Llamada inesperada a ' + url);
}
const VARIABLES = ['STUDIO_FIREBASE_WEB_CONFIG', 'STUDIO_ALLOWED_EMAILS', 'GCP_SERVICE_ACCOUNT', 'GCS_OUTPUT_BUCKET', 'IMAGE_MODEL', 'GCS_PREFIX', 'VERCEL_GIT_COMMIT_SHA'];
beforeEach(() => {
  llamadas = []; google_responde = null;
  cuenta = { localId: 'dueno-id', email: 'dueno@example.com', emailVerified: true, validSince: '1' };
  fetchOriginal = global.fetch; global.fetch = fetchFalso;
  entornoOriginal = Object.fromEntries(VARIABLES.map(k => [k, process.env[k]]));
  for (const k of VARIABLES) delete process.env[k];
  process.env.STUDIO_FIREBASE_WEB_CONFIG = JSON.stringify(firebase);
  process.env.STUDIO_ALLOWED_EMAILS = 'Dueno@Example.com';
});
afterEach(() => {
  global.fetch = fetchOriginal;
  for (const [k, v] of Object.entries(entornoOriginal)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});
function respuesta() {
  return { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; },
    json(v) { this.valor = v; return this; }, end() { this.terminada = true; return this; } };
}
function peticion(opciones = {}) {
  return { url: '/api/salud', method: 'GET', body: {}, ...opciones,
    headers: { host: 'estudio.example', origin: 'https://estudio.example', 'sec-fetch-site': 'same-origin', ...opciones.headers } };
}
const ajustes = () => acceso.configuracion();

// ─── Acceso ───
test('firma RSA real, proyecto exacto y propietario actual: autorizado', async () => {
  const verificar = acceso.crearVerificador();
  const identidad = await verificar(token(), ajustes());
  assert.equal(identidad.uid, 'dueno-id');
  assert.equal(identidad.correo, 'dueno@example.com');
  assert.equal(llamadas.length, 2);
  await verificar(token(), ajustes());
  assert.equal(llamadas.length, 3, 'solo se guardan los certificados; la cuenta se revisa en cada petición');
});

test('tokens falsos, caducados, de otro proyecto, anónimos o sin verificar: cerrado', async () => {
  const verificar = acceso.crearVerificador();
  for (const valor of ['', 'x.y.z', token().slice(0, -10) + 'abcdefghij', token({ exp: ahora() - 1 }), token({ aud: 'otro' }),
    token({ iss: 'https://malo.example' }), token({ iat: ahora() + 10 }), token({ auth_time: ahora() + 10 }), token({ sub: '' }),
    token({ email_verified: false }), token({ firebase: { sign_in_provider: 'anonymous' } }), token({}, { alg: 'none' }), token({}, { kid: '__proto__' })]) {
    await assert.rejects(verificar(valor, ajustes()), e => e.estado === 401);
  }
  assert.equal(llamadas.filter(c => c.url.includes('accounts:lookup')).length, 0);
});

test('un inicio de sesión de Google válido de otra persona no basta', async () => {
  await assert.rejects(acceso.crearVerificador()(token({ email: 'otra@example.com' }), ajustes()), e => e.estado === 403);
  assert.equal(llamadas.filter(c => c.url.includes('accounts:lookup')).length, 0);
});

test('cuentas borradas, deshabilitadas, con otro correo o revocadas: rechazadas', async () => {
  const verificar = acceso.crearVerificador();
  for (const cambio of [null, { disabled: true }, { localId: 'otra' }, { email: 'otra@example.com' }, { emailVerified: false }, { validSince: String(ahora()) }]) {
    cuenta = cambio === null ? null : { localId: 'dueno-id', email: 'dueno@example.com', emailVerified: true, ...cambio };
    await assert.rejects(verificar(token(), ajustes()), e => e.estado === 401);
  }
});

test('una caída de Google nunca abre la puerta ni filtra su diagnóstico', async () => {
  const verificar = acceso.crearVerificador({ pedir: async () => { throw new Error('detalle secreto'); } });
  await assert.rejects(verificar(token(), ajustes()), e => e.estado === 503 && !e.message.includes('secreto'));
});

test('sin configuración todo queda cerrado; la configuración pública no lleva correos', async () => {
  const salida = respuesta();
  await acceso.manejarSesion(peticion({ url: '/api/salud?acceso=config' }), salida);
  assert.deepEqual(salida.valor, { firebase });
  assert.equal(salida.headers['cache-control'], 'private, no-store');
  delete process.env.STUDIO_ALLOWED_EMAILS;
  const cerrada = respuesta();
  assert.equal(await acceso.exigirPropietario(peticion(), cerrada), true);
  assert.equal(cerrada.statusCode, 503);
  assert.match(cerrada.valor.error, /STUDIO_ALLOWED_EMAILS/);
  assert.equal(llamadas.length, 0);
});

test('cookie HttpOnly/Secure/Strict que caduca con el token; salir la borra', async () => {
  const valor = token(), salida = respuesta();
  await acceso.manejarSesion(peticion({ method: 'POST', url: '/api/salud?acceso=sesion', headers: { authorization: 'Bearer ' + valor } }), salida);
  assert.equal(salida.statusCode, 200);
  assert.deepEqual(salida.valor, { uid: 'dueno-id', correo: 'dueno@example.com' });
  assert.match(salida.headers['set-cookie'], /^__Host-drama_sesion=/);
  assert.match(salida.headers['set-cookie'], /Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=\d+/);
  assert.ok(Number(salida.headers['set-cookie'].split('Max-Age=')[1]) <= 3600);
  const estado = respuesta();
  await acceso.manejarSesion(peticion({ url: '/api/salud?acceso=estado', headers: { cookie: acceso.COOKIE + '=' + valor } }), estado);
  assert.equal(estado.statusCode, 200);
  const salir = respuesta();
  await acceso.manejarSesion(peticion({ method: 'POST', url: '/api/salud?acceso=salir' }), salir);
  assert.match(salir.headers['set-cookie'], /Max-Age=0$/);
});

test('un POST de otro sitio o sin origen no crea sesión ni pasa la puerta', async () => {
  for (const origin of ['https://malo.example', undefined, 'null']) {
    const req = peticion({ method: 'POST', headers: { origin, cookie: acceso.COOKIE + '=' + token() } });
    const salida = respuesta();
    await acceso.exigirPropietario(req, salida);
    assert.equal(salida.statusCode, 403);
    req.url = '/api/salud?acceso=sesion';
    const sesion = respuesta();
    await acceso.manejarSesion(req, sesion);
    assert.equal(sesion.statusCode, 403);
  }
  const soloCookie = respuesta();
  await acceso.manejarSesion(peticion({ method: 'POST', url: '/api/salud?acceso=sesion', headers: { cookie: acceso.COOKIE + '=' + token() } }), soloCookie);
  assert.equal(soloCookie.statusCode, 401, 'la sesión solo se crea con el token recién emitido');
  assert.equal(llamadas.length, 0);
});

test('todo endpoint rechaza llamadas sin sesión antes de tocar Google', async () => {
  for (const nombre of fs.readdirSync(path.join(RAIZ, 'api')).filter(x => x.endsWith('.js'))) {
    const manejador = require(path.join(RAIZ, 'api', nombre));
    for (const metodo of ['GET', 'POST']) {
      const salida = respuesta();
      await manejador(peticion({ method: metodo, url: '/api/' + nombre.slice(0, -3) }), salida);
      assert.ok([401, 403, 405].includes(salida.statusCode), `${nombre} ${metodo} respondió ${salida.statusCode}`);
      assert.equal(llamadas.length, 0, nombre + ' habló con Google sin sesión');
    }
  }
});

// ─── Errores ───
test('un bloqueo se reconoce antes que una cuota', () => {
  assert.equal(errores.clasificar('429 RESOURCE_EXHAUSTED'), 'cuota');
  assert.equal(errores.clasificar('Quota exceeded for aiplatform'), 'cuota');
  assert.equal(errores.clasificar('rate limit reached'), 'cuota');
  assert.equal(errores.clasificar('Sin capacidad en ninguna región'), 'cuota');
  assert.equal(errores.clasificar('Response was blocked due to SAFETY'), 'bloqueo');
  assert.equal(errores.clasificar('429 prompt blocked by safety filters'), 'bloqueo', 'bloqueo primero aunque diga 429');
  assert.equal(errores.clasificar('RECITATION'), 'bloqueo');
  assert.equal(errores.clasificar('Imagen bloqueada'), 'bloqueo');
  assert.equal(errores.clasificar('The resource you requested was not found'), 'otro', '"resource" a secas no es cuota');
  assert.equal(errores.clasificar('Error 4290 interno'), 'otro');
});

test('los errores de Google se explican en español y nunca devuelven 401/403', () => {
  const bloqueo = errores.errorDeGoogle('la imagen', 400, { error: { message: 'blocked by safety' } });
  assert.equal(bloqueo.tipo, 'bloqueo'); assert.equal(bloqueo.estado, 422); assert.match(bloqueo.message, /Reintentar no sirve/);
  const cuota = errores.errorDeGoogle('el video', 429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } });
  assert.equal(cuota.tipo, 'cuota'); assert.equal(cuota.estado, 429);
  for (const codigo of [401, 403, 404, 500]) {
    const e = errores.errorDeGoogle('el texto', codigo, { error: { message: 'detalle' } });
    assert.equal(e.estado, 502); assert.match(e.detalle, /detalle/);
  }
});

// ─── Puerta ───
test('la puerta censura claves y tokens y convierte fallos en palabras', async () => {
  process.env.GCP_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'p', client_email: 'a@p.iam.gserviceaccount.com', private_key: claveServicio });
  const fuga = puerta({ metodos: ['GET'] }, async () => ({
    ok: true, private_key: claveServicio, anidado: { access_token: 'ya29.secreto', texto: 'Bearer ya29.otro y ' + claveServicio, firma: 'https://storage.googleapis.com/b/o?X-Goog-Signature=abc' },
  }));
  const salida = respuesta();
  await fuga(peticion({ headers: { cookie: acceso.COOKIE + '=' + token() } }), salida);
  assert.equal(salida.statusCode, 200);
  const texto = JSON.stringify(salida.valor);
  assert.ok(!texto.includes('PRIVATE KEY') && !texto.includes('ya29.') && !('private_key' in salida.valor));
  assert.match(texto, /X-Goog-Signature=abc/, 'las URL firmadas sí salen');

  const falla = puerta({ metodos: ['GET'] }, async () => { throw errores.errorDeGoogle('la imagen', 429, 'RESOURCE_EXHAUSTED ' + claveServicio); });
  const error = respuesta();
  await falla(peticion({ headers: { cookie: acceso.COOKIE + '=' + token() } }), error);
  assert.equal(error.statusCode, 429);
  assert.equal(error.valor.tipo, 'cuota');
  assert.ok(!JSON.stringify(error.valor).includes('PRIVATE KEY'));

  const metodo = respuesta();
  await falla(peticion({ method: 'DELETE' }), metodo);
  assert.equal(metodo.statusCode, 405);
  assert.match(metodo.valor.error, /no admite/);
});

test('la puerta no pide credenciales de Google antes de comprobar al propietario', async () => {
  let pedidas = 0;
  const endpoint = puerta({ metodos: ['GET'] }, async (req, ctx) => { pedidas++; await ctx.google(); return {}; });
  const salida = respuesta();
  await endpoint(peticion(), salida);
  assert.equal(salida.statusCode, 401);
  assert.equal(pedidas, 0);
});

// ─── Configuración ───
test('modelos y variables: los de la especificación, sin sustitutos', () => {
  assert.deepEqual(google.MODELOS_IMAGEN, ['gemini-3.1-flash-image', 'gemini-3-pro-image']);
  assert.deepEqual(google.MODELOS_VIDEO, ['veo-3.1-lite-generate-001', 'veo-3.1-fast-generate-001', 'veo-3.1-generate-001']);
  const c = google.cfg;
  assert.equal(c.modeloTexto, 'gemini-3.1-pro-preview');
  assert.equal(c.ubicacionTexto, 'global');
  assert.equal(c.modeloImagen, 'gemini-3.1-flash-image');
  assert.deepEqual(c.regionesImagen, ['us-central1', 'europe-west4', 'us-east4']);
  assert.equal(c.modeloVideo, 'veo-3.1-lite-generate-001');
  assert.equal(c.modeloVoz, 'gemini-2.5-flash-preview-tts');
  assert.equal(c.ubicacionVoz, 'us-central1');
  assert.equal(c.modeloMusica, 'lyria-002');
  assert.equal(c.ubicacionMusica, 'us-central1');
  assert.equal(c.modeloSubtitulos, 'latest_long');
  assert.equal(c.idiomaSubtitulos, 'es-US');
  assert.equal(c.prefijo, 'drama-studio');
  assert.equal(c.trabajoMontaje, 'drama-studio-montage');
  assert.equal(c.regionMontaje, 'us-central1');
  assert.equal(google.ubicacionImagen('gemini-3.1-flash-image'), 'global');
  process.env.IMAGE_MODEL = 'gemini-3-pro-image';
  process.env.GCS_PREFIX = '/otra/';
  process.env.GCS_OUTPUT_BUCKET = 'gs://mi-bucket/';
  assert.equal(c.modeloImagen, 'gemini-3-pro-image');
  assert.equal(c.prefijo, 'otra');
  assert.equal(c.bucket, 'mi-bucket');
  const filas = google.describirAjustes();
  for (const variable of ['SCRIPT_MODEL', 'SCRIPT_LOCATION', 'IMAGE_MODEL', 'IMAGE_REGIONS', 'IMAGE_MODEL_LOCATIONS', 'VEO_MODEL', 'GCP_LOCATION',
    'TTS_MODEL', 'TTS_LOCATION', 'MUSIC_MODEL', 'MUSIC_LOCATION', 'STT_MODEL', 'STT_LANGUAGE', 'GCS_PREFIX', 'MONTAJE_JOB', 'MONTAJE_REGION']) {
    assert.ok(filas.some(f => f.variable === variable), 'falta ' + variable + ' en APIs configuradas');
  }
  assert.equal(filas.find(f => f.variable === 'IMAGE_MODEL').propio, true);
  assert.equal(filas.find(f => f.variable === 'VEO_MODEL').propio, false);
});

test('GCP_SERVICE_ACCOUNT acepta JSON o base64 y explica lo que falta', () => {
  const datos = { project_id: 'p', client_email: 'a@p.iam.gserviceaccount.com', private_key: claveServicio };
  process.env.GCP_SERVICE_ACCOUNT = JSON.stringify(datos);
  assert.equal(google.cargarCuentaServicio().project_id, 'p');
  process.env.GCP_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(datos)).toString('base64');
  assert.equal(google.cargarCuentaServicio().client_email, 'a@p.iam.gserviceaccount.com');
  delete process.env.GCP_SERVICE_ACCOUNT;
  assert.throws(() => google.cargarCuentaServicio(), /Falta la variable GCP_SERVICE_ACCOUNT/);
  process.env.GCP_SERVICE_ACCOUNT = 'esto no es nada';
  assert.throws(() => google.cargarCuentaServicio(), /ni un base64 válido/);
  process.env.GCP_SERVICE_ACCOUNT = JSON.stringify({ ...datos, private_key: '' });
  assert.throws(() => google.cargarCuentaServicio(), /clave privada/);
});

// ─── Salud ───
test('salud: dice cuenta, proyecto y bucket sin devolver la clave', async () => {
  const salud = require('../api/salud');
  process.env.GCP_SERVICE_ACCOUNT = Buffer.from(JSON.stringify({ project_id: 'proyecto-drama', client_email: 'drama-studio@proyecto-drama.iam.gserviceaccount.com', private_key: claveServicio })).toString('base64');
  process.env.GCS_OUTPUT_BUCKET = 'bucket-drama';
  process.env.VERCEL_GIT_COMMIT_SHA = '0123456789abcdef';
  const vistas = [];
  google_responde = async url => {
    vistas.push(url);
    if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'ya29.servicio', expires_in: 3600 }));
    if (url.endsWith('/b/bucket-drama')) return new Response(JSON.stringify({ location: 'US' }));
    if (url.includes('/iam/testPermissions')) return new Response(JSON.stringify({ permissions: ['storage.objects.create', 'storage.objects.get', 'storage.objects.list', 'storage.objects.delete', 'storage.buckets.update'] }));
    if (url.includes('serviceusage')) return new Response(JSON.stringify({ state: url.includes('speech') ? 'DISABLED' : 'ENABLED' }));
    throw new Error('inesperado ' + url);
  };
  const salida = respuesta();
  await salud(peticion({ headers: { cookie: acceso.COOKIE + '=' + token() } }), salida);
  assert.equal(salida.statusCode, 200);
  const v = salida.valor;
  assert.equal(v.sesion.correo, 'dueno@example.com');
  assert.equal(v.cuentaServicio.proyecto, 'proyecto-drama');
  assert.equal(v.cuentaServicio.correo, 'drama…io@proyecto-drama.iam.gserviceaccount.com');
  assert.equal(v.bucket.nombre, 'bucket-drama');
  assert.equal(v.bucket.carpeta, 'drama-studio/');
  assert.equal(v.comprobaciones.bucket.ubicacion, 'US');
  assert.equal(v.comprobaciones.permisos.ok, true);
  assert.equal(v.servicios.find(s => s.id === 'speech.googleapis.com').estado, 'apagada');
  assert.equal(v.version.commit, '0123456');
  assert.deepEqual(v.acceso.correosAutorizados, ['dueno@example.com']);
  const texto = JSON.stringify(v);
  assert.ok(!texto.includes('PRIVATE KEY') && !texto.includes('ya29.'));
  assert.ok(!vistas.some(u => u.includes('aiplatform.googleapis.com/v1/projects')), 'la salud no llama a ningún modelo');
});

test('salud: sin variables lo dice con palabras y no se cae', async () => {
  const salud = require('../api/salud');
  const salida = respuesta();
  await salud(peticion({ headers: { cookie: acceso.COOKIE + '=' + token() } }), salida);
  assert.equal(salida.statusCode, 200);
  assert.match(salida.valor.cuentaServicio.error, /GCP_SERVICE_ACCOUNT/);
  assert.match(salida.valor.bucket.error, /GCS_OUTPUT_BUCKET/);
});

// ─── Texto ───
function conCuentaDeServicio() {
  process.env.GCP_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'proyecto-drama', client_email: 'drama-studio@proyecto-drama.iam.gserviceaccount.com', private_key: claveServicio });
  process.env.GCS_OUTPUT_BUCKET = 'bucket-drama';
}
const conSesion = (extra = {}) => peticion({ method: 'POST', url: '/api/texto', headers: { cookie: acceso.COOKIE + '=' + token() }, ...extra });

test('texto: endpoint global, pensamiento descartado, límites amplios y filtros configurables en OFF', async () => {
  conCuentaDeServicio();
  const texto = require('../api/texto');
  let enviado, urlVertex;
  google_responde = async (url, opciones) => {
    if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'ya29.servicio', expires_in: 3600 }));
    urlVertex = url; enviado = JSON.parse(opciones.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: 'pensando…' }, { text: '{"ok":true}' }] } }] }));
  };
  const salida = respuesta();
  await texto(conSesion({ body: { sistema: 's', mensaje: 'hola' } }), salida);
  assert.equal(salida.statusCode, 200);
  assert.equal(salida.valor.texto, '{"ok":true}');
  assert.match(urlVertex, /^https:\/\/aiplatform\.googleapis\.com\/v1\/projects\/proyecto-drama\/locations\/global\/publishers\/google\/models\/gemini-3\.1-pro-preview:generateContent$/);
  assert.equal(enviado.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
  assert.ok(enviado.generationConfig.maxOutputTokens >= 4096, 'el pensamiento gasta del mismo límite');
  assert.equal(enviado.generationConfig.responseMimeType, 'application/json');
  assert.ok(enviado.safetySettings.every(s => s.threshold === 'OFF'));
});

test('texto: cuota, bloqueo y falta de espacio se explican con su tipo', async () => {
  conCuentaDeServicio();
  const texto = require('../api/texto');
  const casos = [
    [new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }), { status: 429 }), 429, 'cuota'],
    [new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] })), 422, 'bloqueo'],
    [new Response(JSON.stringify({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } })), 422, 'bloqueo'],
    [new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] })), 502, 'tiempo'],
    [new Response(JSON.stringify({ error: { code: 404, message: 'Publisher model not found' } }), { status: 404 }), 502, 'google'],
  ];
  for (const [respuestaGoogle, estado, tipo] of casos) {
    google_responde = async url => url === 'https://oauth2.googleapis.com/token'
      ? new Response(JSON.stringify({ access_token: 'ya29.servicio', expires_in: 3600 })) : respuestaGoogle;
    const salida = respuesta();
    await texto(conSesion({ body: { mensaje: 'hola' } }), salida);
    assert.equal(salida.statusCode, estado, tipo);
    assert.equal(salida.valor.tipo, tipo);
    assert.ok(salida.valor.error.length > 10);
  }
});

// ─── Proyectos ───
function bucketFalso() {
  const objetos = new Map(); let generacion = 100;
  const respuestaJson = (v, status = 200) => new Response(JSON.stringify(v), { status });
  google_responde = async (url, opciones = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return respuestaJson({ access_token: 'ya29.servicio', expires_in: 3600 });
    const u = new URL(url);
    if (u.pathname.startsWith('/upload/')) {
      const nombre = u.searchParams.get('name'), condicion = u.searchParams.get('ifGenerationMatch');
      const actual = objetos.get(nombre);
      if (condicion !== null && String(actual?.generacion || '0') !== condicion) return respuestaJson({ error: { code: 412 } }, 412);
      const g = String(++generacion);
      objetos.set(nombre, { cuerpo: opciones.body, generacion: g });
      return respuestaJson({ generation: g });
    }
    const m = /\/storage\/v1\/b\/bucket-drama\/o(?:\/([^?]+))?/.exec(u.pathname);
    if (!m) throw new Error('inesperado ' + url);
    if (!m[1]) {
      const prefijo = u.searchParams.get('prefix');
      return respuestaJson({ items: [...objetos.keys()].filter(n => n.startsWith(prefijo)).map(name => ({ name })) });
    }
    const obj = objetos.get(decodeURIComponent(m[1]));
    if (!obj) return respuestaJson({ error: { code: 404 } }, 404);
    if (u.searchParams.get('alt') === 'media') return new Response(obj.cuerpo);
    return respuestaJson({ generation: obj.generacion });
  };
  return objetos;
}
const proyectosReq = (opciones = {}) => peticion({ url: '/api/proyectos', headers: { cookie: acceso.COOKIE + '=' + token() }, ...opciones });

test('proyectos: crear, leer con su versión, listar y conservar la versión anterior', async () => {
  conCuentaDeServicio();
  const objetos = bucketFalso();
  const proyectos = require('../api/proyectos');
  const id = 'pabc12345xyz';
  const crear = respuesta();
  await proyectos(proyectosReq({ method: 'POST', body: { id, datos: { formulario: { genero: 'naufragio' } }, nombre: '', generacionBase: '0' } }), crear);
  assert.equal(crear.statusCode, 200);
  assert.equal(crear.valor.nombre, 'Drama sin título');
  assert.ok(objetos.has('drama-studio/proyectos/pabc12345xyz/proyecto.json'), 'todo bajo la carpeta del estudio');
  const leer = respuesta();
  await proyectos(proyectosReq({ url: '/api/proyectos?id=' + id }), leer);
  assert.equal(leer.statusCode, 200);
  assert.equal(leer.valor.generacion, crear.valor.generacion);
  const segundo = respuesta();
  await proyectos(proyectosReq({ method: 'POST', body: { id, datos: { universo: { titulo: 'La Isla' } }, nombre: 'La Isla', generacionBase: crear.valor.generacion } }), segundo);
  assert.equal(segundo.statusCode, 200);
  assert.ok([...objetos.keys()].some(n => n.includes('/historial/')), 'la versión sustituida se guarda en el historial');
  const lista = respuesta();
  await proyectos(proyectosReq({ url: '/api/proyectos' }), lista);
  assert.deepEqual(lista.valor.proyectos.map(p => p.nombre), ['La Isla']);
});

test('proyectos: una versión vieja no pisa la nueva y un reintento de creación no duplica', async () => {
  conCuentaDeServicio();
  bucketFalso();
  const proyectos = require('../api/proyectos');
  const id = 'pconflicto001';
  const a = respuesta();
  await proyectos(proyectosReq({ method: 'POST', body: { id, datos: { a: 1 }, generacionBase: '0' } }), a);
  const repetido = respuesta();
  await proyectos(proyectosReq({ method: 'POST', body: { id, datos: { a: 2 }, generacionBase: '0' } }), repetido);
  assert.equal(repetido.statusCode, 409);
  assert.equal(repetido.valor.tipo, 'conflicto');
  const sinVersion = respuesta();
  await proyectos(proyectosReq({ method: 'POST', body: { id, datos: { a: 3 } } }), sinVersion);
  assert.equal(sinVersion.statusCode, 400);
});

test('proyectos: una lectura fallida es un error, nunca un proyecto vacío', async () => {
  conCuentaDeServicio();
  google_responde = async url => url === 'https://oauth2.googleapis.com/token'
    ? new Response(JSON.stringify({ access_token: 'ya29.servicio', expires_in: 3600 }))
    : new Response('{"error":{"code":503}}', { status: 503 });
  const proyectos = require('../api/proyectos');
  const leer = respuesta();
  await proyectos(proyectosReq({ url: '/api/proyectos?id=pfalla0001' }), leer);
  assert.equal(leer.statusCode, 502);
  assert.match(leer.valor.error, /No se supone vacío/);
  const lista = respuesta();
  await proyectos(proyectosReq({ url: '/api/proyectos' }), lista);
  assert.equal(lista.statusCode, 502);
  assert.match(lista.valor.error, /No se supone vacía/);
  const malo = respuesta();
  await proyectos(proyectosReq({ url: '/api/proyectos?id=../../otro' }), malo);
  assert.equal(malo.statusCode, 400);
});

// ─── Imagen ───
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function vertexImagen(respuestaVertex) {
  const guardados = {}, llamadasVertex = [];
  google_responde = async (url, opciones = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'ya29.servicio', expires_in: 3600 }));
    if (url.includes('aiplatform.googleapis.com')) { llamadasVertex.push({ url, cuerpo: JSON.parse(opciones.body) }); return respuestaVertex(); }
    if (url.includes('/upload/storage/v1/')) { guardados[new URL(url).searchParams.get('name')] = opciones.body; return new Response(JSON.stringify({ generation: '7' })); }
    if (url.includes('alt=media')) {
      if (url.includes('falta')) return new Response('{}', { status: 404 });
      return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    }
    throw new Error('inesperado ' + url);
  };
  return { guardados, llamadasVertex };
}
const conImagen = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG.toString('base64') } }] } }] }));
const imagenReq = body => peticion({ method: 'POST', url: '/api/imagen', headers: { cookie: acceso.COOKIE + '=' + token() }, body });
const base = 'drama-studio/proyectos/pimagen0001/medios/';

test('imagen: contrato de estilo primero, ficha con su contrato, endpoint global y guardado en el bucket', async () => {
  conCuentaDeServicio();
  const { guardados, llamadasVertex } = vertexImagen(conImagen);
  const imagen = require('../api/imagen');
  const salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'plano-e1-1', prompt: 'Lin Feng kneels in the courtyard while Wang Hu shouts.', formato: '9:16',
    personajes: [{ nombre: 'Lin Feng', ruta: base + 'personaje-c1.png' }], continuidad: base + 'plano-e1-0.png', escenario: base + 'escenario-l1.png' }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  assert.equal(salida.valor.ruta, base + 'plano-e1-1.png');
  assert.match(salida.valor.url, /X-Goog-Signature=/);
  assert.ok(guardados[base + 'plano-e1-1.png'], 'se guardó en el bucket desde el servidor');
  const { url, cuerpo } = llamadasVertex[0];
  assert.match(url, /\/locations\/global\/publishers\/google\/models\/gemini-3\.1-flash-image:generateContent$/);
  const partes = cuerpo.contents[0].parts;
  assert.match(partes[0].text, /^ART STYLE \(non-negotiable.*POLISHED SEMI-REALISTIC ASIAN SHORT-DRAMA KEY ART/);
  assert.match(partes[0].text, /STRICTLY FORBIDDEN: 2D anime, cel shading/);
  assert.match(partes[0].text, /made to stop the scroll\.$/);
  assert.ok(partes[1].inlineData, 'continuidad');
  assert.match(partes[2].text, /^This reference is the immediately preceding physical state/);
  assert.ok(partes[3].inlineData, 'ficha');
  assert.match(partes[4].text, /^CHARACTER REFERENCE above: this is Lin Feng\. Use it ONLY as the identity anchor/);
  assert.match(partes.at(-1).text, /ABSOLUTELY NO TEXT[\s\S]*Scene to show:\nLin Feng kneels/);
  assert.equal(cuerpo.generationConfig.imageConfig.aspectRatio, '9:16');
});

test('imagen: sin ficha no se genera; bloqueo, solo-texto y cuota se distinguen; rutas ajenas se rechazan', async () => {
  conCuentaDeServicio();
  const imagen = require('../api/imagen');
  let r = vertexImagen(conImagen);
  let salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'plano-e1-1', prompt: 'Lin Feng kneels in the courtyard.', personajes: [{ nombre: 'Lin Feng', ruta: base + 'falta.png' }] }), salida);
  assert.equal(salida.statusCode, 409);
  assert.equal(salida.valor.tipo, 'falta_referencia');
  assert.equal(r.llamadasVertex.length, 0, 'sin identidad no se pide la imagen');
  salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'plano-e1-1', prompt: 'Lin Feng kneels in the courtyard.', personajes: [{ nombre: 'Lin Feng', ruta: 'drama-studio/proyectos/potro00001/medios/x.png' }] }), salida);
  assert.equal(salida.statusCode, 400);
  for (const [respuestaVertex, estado, tipo] of [
    [() => new Response(JSON.stringify({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] })), 422, 'bloqueo'],
    [() => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'No puedo' }] } }] })), 422, 'bloqueo'],
    [() => new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }), { status: 429 }), 429, 'cuota'],
  ]) {
    r = vertexImagen(respuestaVertex);
    salida = respuesta();
    await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'escenario-l1', prompt: 'An empty stone courtyard at dawn.', formato: '16:9' }), salida);
    assert.equal(salida.statusCode, estado, tipo);
    assert.equal(salida.valor.tipo, tipo);
    assert.equal(r.llamadasVertex.length, 1, 'ni el bloqueo ni la cuota se reintentan dentro del servidor con un modelo global');
  }
});

test('urls: firma solo rutas del proyecto', async () => {
  conCuentaDeServicio();
  vertexImagen(conImagen);
  const urls = require('../api/urls');
  const ok = respuesta();
  await urls(peticion({ method: 'POST', url: '/api/urls', headers: { cookie: acceso.COOKIE + '=' + token() }, body: { proyecto: 'pimagen0001', ver: [base + 'personaje-c1.png'] } }), ok);
  assert.equal(ok.statusCode, 200);
  assert.match(ok.valor.urls[base + 'personaje-c1.png'], /X-Goog-Signature=/);
  const malo = respuesta();
  await urls(peticion({ method: 'POST', url: '/api/urls', headers: { cookie: acceso.COOKIE + '=' + token() }, body: { proyecto: 'pimagen0001', ver: ['drama-studio/proyectos/pimagen0001/proyecto.json'] } }), malo);
  assert.equal(malo.statusCode, 400);
});

// ─── Video ───
const videoReq = (ruta, body) => peticion({ method: 'POST', url: ruta, headers: { cookie: acceso.COOKIE + '=' + token() }, body });
const OPERACION = 'projects/proyecto-prueba/locations/us-central1/publishers/google/models/veo-3.1-fast-generate-001/operations/1234-abcd';

test('video-inicio: lee la imagen del bucket, pide 4 s con audio nativo, guarda en la carpeta del proyecto y respeta el modelo', async () => {
  conCuentaDeServicio();
  process.env.GCS_OUTPUT_BUCKET = 'bucket-prueba';
  const { llamadasVertex } = vertexImagen(() => new Response(JSON.stringify({ name: OPERACION })));
  const inicio = require('../api/video-inicio');
  const salida = respuesta();
  await inicio(videoReq('/api/video-inicio', { proyecto: 'pimagen0001', clave: 'video-e1-1', imagen: base + 'plano-e1-1.png', modelo: 'veo-3.1-fast-generate-001', formato: '16:9',
    prompt: 'STYLE — ABSOLUTELY MANDATORY: preserve the exact rendering of the first frame. SHOT MOTION: Lin Feng slowly raises his head.', negativo: 'text, watermark' }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  assert.equal(salida.valor.operacion, OPERACION);
  assert.equal(salida.valor.modelo, 'veo-3.1-fast-generate-001');
  const { url, cuerpo } = llamadasVertex[0];
  assert.match(url, /us-central1-aiplatform\.googleapis\.com\/.*\/models\/veo-3\.1-fast-generate-001:predictLongRunning$/);
  assert.equal(cuerpo.parameters.durationSeconds, 4);
  assert.equal(cuerpo.parameters.generateAudio, true);
  assert.equal(cuerpo.parameters.aspectRatio, '16:9');
  assert.equal(cuerpo.parameters.negativePrompt, 'text, watermark');
  assert.equal(cuerpo.parameters.storageUri, 'gs://bucket-prueba/' + base + 'video-e1-1/');
  assert.ok(cuerpo.instances[0].image.bytesBase64Encoded, 'la imagen del plano viaja desde el bucket');
  assert.equal(cuerpo.instances[0].lastFrame, undefined, 'sin encadenado de fotogramas');
  // Un modelo desconocido no se acepta tal cual: se usa el configurado.
  const otro = respuesta();
  await inicio(videoReq('/api/video-inicio', { proyecto: 'pimagen0001', clave: 'video-e1-1', imagen: base + 'plano-e1-1.png', modelo: 'veo-9', prompt: 'SHOT MOTION: Lin Feng slowly raises his head and looks away.' }), otro);
  assert.match(llamadasVertex[1].url, /veo-3\.1-lite-generate-001:predictLongRunning$/);
  // Sin imagen no se arranca; una imagen de otro proyecto se rechaza; un bloqueo es bloqueo.
  const sin = respuesta();
  await inicio(videoReq('/api/video-inicio', { proyecto: 'pimagen0001', clave: 'video-e1-1', prompt: 'SHOT MOTION: Lin Feng slowly raises his head and looks away.' }), sin);
  assert.equal(sin.statusCode, 409);
  const ajena = respuesta();
  await inicio(videoReq('/api/video-inicio', { proyecto: 'pimagen0001', clave: 'video-e1-1', imagen: 'drama-studio/proyectos/potro00001/medios/x.png', prompt: 'SHOT MOTION: Lin Feng slowly raises his head and looks away.' }), ajena);
  assert.equal(ajena.statusCode, 400);
  vertexImagen(() => new Response(JSON.stringify({ error: { code: 400, message: 'The prompt could not be submitted. It was blocked by safety filters.' } }), { status: 400 }));
  const bloqueo = respuesta();
  await inicio(videoReq('/api/video-inicio', { proyecto: 'pimagen0001', clave: 'video-e1-1', imagen: base + 'plano-e1-1.png', prompt: 'SHOT MOTION: Lin Feng slowly raises his head and looks away.' }), bloqueo);
  assert.equal(bloqueo.statusCode, 422);
  assert.equal(bloqueo.valor.tipo, 'bloqueo');
});

test('video-estado: consulta en el modelo que arrancó; listo con URL de 7 días; bloqueos y rutas ajenas', async () => {
  conCuentaDeServicio();
  process.env.GCS_OUTPUT_BUCKET = 'bucket-prueba';
  const estado = require('../api/video-estado');
  let r = vertexImagen(() => new Response(JSON.stringify({ name: OPERACION, done: false })));
  let salida = respuesta();
  await estado(videoReq('/api/video-estado', { proyecto: 'pimagen0001', operacion: OPERACION }), salida);
  assert.equal(salida.statusCode, 200);
  assert.equal(salida.valor.listo, false);
  assert.match(r.llamadasVertex[0].url, /veo-3\.1-fast-generate-001:fetchPredictOperation$/);
  assert.equal(r.llamadasVertex[0].cuerpo.operationName, OPERACION);
  const mp4 = `gs://bucket-prueba/${base}video-e1-1/987/sample_0.mp4`;
  vertexImagen(() => new Response(JSON.stringify({ done: true, response: { videos: [{ gcsUri: mp4, mimeType: 'video/mp4' }] } })));
  salida = respuesta();
  await estado(videoReq('/api/video-estado', { proyecto: 'pimagen0001', operacion: OPERACION }), salida);
  assert.equal(salida.valor.listo, true);
  assert.equal(salida.valor.ruta, `${base}video-e1-1/987/sample_0.mp4`);
  assert.match(salida.valor.url, /X-Goog-Expires=604800/);
  for (const [respuestaVertex, codigo, tipo] of [
    [() => new Response(JSON.stringify({ done: true, response: { raiMediaFilteredCount: 1, raiMediaFilteredReasons: ['person'] } })), 422, 'bloqueo'],
    [() => new Response(JSON.stringify({ done: true, error: { code: 13, message: 'internal' } })), 502, 'veo_fallo'],
    [() => new Response(JSON.stringify({ done: true, response: { videos: [{ gcsUri: 'gs://otro-bucket/x.mp4' }] } })), 502, 'veo_fallo'],
    [() => new Response(JSON.stringify({ done: true, response: { videos: [{ gcsUri: 'gs://bucket-prueba/drama-studio/proyectos/potro00001/medios/x.mp4' }] } })), 400, 'peticion'],
  ]) {
    vertexImagen(respuestaVertex);
    salida = respuesta();
    await estado(videoReq('/api/video-estado', { proyecto: 'pimagen0001', operacion: OPERACION }), salida);
    assert.equal(salida.statusCode, codigo, tipo);
    assert.equal(salida.valor.tipo, tipo);
  }
  salida = respuesta();
  await estado(videoReq('/api/video-estado', { proyecto: 'pimagen0001', operacion: 'projects/x/locations/y/publishers/google/models/otro/operations/1' }), salida);
  assert.equal(salida.statusCode, 400);
});

test('imagen: la dirección de aspecto del proyecto y la regla ecchi llegan al modelo', async () => {
  conCuentaDeServicio();
  const { llamadasVertex } = vertexImagen(conImagen);
  const imagen = require('../api/imagen');
  const salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'personaje-c2', prompt: 'Single clean CHARACTER REFERENCE still of Mei, a strikingly beautiful adult woman.', ecchi: true,
    direccion: 'CASTING of a high-budget Asian drama. GENRE LOOK — romance. She is nude.' }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  const ultimo = llamadasVertex[0].cuerpo.contents[0].parts.at(-1).text;
  assert.match(ultimo, /10\. ADULT ECCHI PROJECT/);
  assert.match(ultimo, /PROJECT LOOK \(chosen by the owner — apply all of it\):\nCASTING of a high-budget Asian drama\. GENRE LOOK — romance\./);
  assert.ok(!/\bnude\b/.test(ultimo), 'la dirección también pasa por el saneado');
  assert.ok(ultimo.indexOf('PROJECT LOOK') < ultimo.indexOf('Scene to show:'));
});

test('imagen: estado de la escena, fuera de cuadro, cambio y mapa de la escena; la regla 2 ya no borra a quien sigue en la habitación', async () => {
  conCuentaDeServicio();
  const { llamadasVertex } = vertexImagen(conImagen);
  const imagen = require('../api/imagen');
  const salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'plano-e1-3', prompt: 'Scene with Lin Fan (topknot, grey linen): medium shot, he sits up on the dirt floor rubbing his head.',
    personajes: [{ nombre: 'Lin Fan', ruta: base + 'personaje-c1.png' }], continuidad: base + 'plano-e1-2.png', situacion: base + 'plano-e1-1.png',
    estado: 'Lin Fan sits up on the dirt floor near the stove; Su Mei stands at the table on the left, checking a cloth bag.',
    cambio: 'Lin Fan, who was lying unconscious, now sits up rubbing his head.', fuera: ['Su Mei'] }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  const partes = llamadasVertex[0].cuerpo.contents[0].parts;
  assert.match(partes[2].text, /^This reference is the immediately preceding physical state/);
  assert.match(partes[4].text, /^SCENE MAP above: the opening wide shot of this SAME scene/);
  assert.match(partes[6].text, /^CHARACTER REFERENCE above: this is Lin Fan/);
  const ultimo = partes.at(-1).text;
  assert.ok(!/nobody else beyond those mentioned/.test(ultimo), 'con estado no se dice «a nadie más»');
  assert.match(ultimo, /PRESENT BUT OUT OF FRAME \(still in the room; this framing leaves them out\): Su Mei\./);
  assert.match(ultimo, /SCENE STATE AT THIS INSTANT[^\n]*\nLin Fan sits up on the dirt floor near the stove; Su Mei stands at the table/);
  assert.match(ultimo, /WHAT CHANGED SINCE THE PREVIOUS SHOT[^\n]*\nLin Fan, who was lying unconscious, now sits up/);
  assert.ok(ultimo.indexOf('SCENE STATE') < ultimo.indexOf('Scene to show:'));
  // Una ficha (sin estado) conserva la regla de siempre.
  vertexImagen(conImagen);
  const ficha = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'personaje-c1', prompt: 'Single clean CHARACTER REFERENCE still of Lin Fan.' }), ficha);
  assert.equal(ficha.statusCode, 200);
});

test('imagen: si Google tarda demasiado se corta con tiempo de sobra y lo dice; no se reintenta en el servidor', async () => {
  conCuentaDeServicio();
  const imagen = require('../api/imagen');
  const r = vertexImagen(() => { throw Object.assign(new Error('tarde'), { name: 'TimeoutError' }); });
  const salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'escenario-l1', prompt: 'An empty stone courtyard at dawn.' }), salida);
  assert.equal(salida.statusCode, 504);
  assert.equal(salida.valor.tipo, 'tiempo');
  assert.match(salida.valor.error, /No se reintenta solo, para no pagarla dos veces/);
  assert.equal(r.llamadasVertex.length, 1);
});

test('imagen: el lugar va en texto (ficha completa) y una imagen de escenario ya no se adjunta; escala real', async () => {
  conCuentaDeServicio();
  const { llamadasVertex } = vertexImagen(conImagen);
  const imagen = require('../api/imagen');
  const salida = respuesta();
  const ficha = 'Desert island (exterior). A crescent of white sand curves to the left; a dense palm grove rises behind it; black volcanic rocks stand on the right; the broken hull of the ship lies half-buried in the sand at the centre.';
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'plano-e1-1', prompt: 'Scene with Su Mei (long black hair, linen dress): wide shot, she stands beside the hull, facing the sea.',
    personajes: [{ nombre: 'Su Mei', ruta: base + 'personaje-c2.png' }], escenario: base + 'escenario-l1.png', lugar: ficha }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  const partes = llamadasVertex[0].cuerpo.contents[0].parts;
  assert.equal(partes.filter(p => p.inlineData).length, 1, 'solo la ficha del personaje: el escenario no viaja como imagen');
  assert.ok(!partes.some(p => /LOCATION REFERENCE above/.test(p.text || '')));
  const ultimo = partes.at(-1).text;
  assert.match(ultimo, /LOCATION — the complete, fixed description of this place\. Every shot of this place shows these same elements in these same positions/);
  assert.ok(ultimo.includes(ficha), 'la ficha llega completa, palabra por palabra');
  assert.ok(ultimo.indexOf('LOCATION —') < ultimo.indexOf('Scene to show:'));
  assert.match(ultimo, /8\. REAL-WORLD SCALE AND ONE PERSPECTIVE:.*a table top reaches an adult's hip/);
});

test('imagen: la tela nunca se transparenta y esa regla va al final, después de la escena', async () => {
  conCuentaDeServicio();
  const { llamadasVertex } = vertexImagen(conImagen);
  const imagen = require('../api/imagen');
  const salida = respuesta();
  await imagen(imagenReq({ proyecto: 'pimagen0001', clave: 'personaje-c2', prompt: 'Single clean CHARACTER REFERENCE still of Lin Xue, wearing a wet see-through white blouse and a black pencil skirt.', ecchi: true }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  const ultimo = llamadasVertex[0].cuerpo.contents[0].parts.at(-1).text;
  assert.match(ultimo, /11\. NO SEE-THROUGH \(always\): the fabric over the breasts is never see-through/);
  assert.match(ultimo, /This is NOT a modesty rule and nothing else gets covered up: keep the low neckline, visible cleavage/, 'en ecchi no se tapa nada más');
  assert.ok(ultimo.trim().endsWith('No text anywhere in the image.'));
  assert.match(ultimo, /wearing a wet opaque white blouse/, 'el saneado quita «see-through»');
  assert.ok(ultimo.trim().endsWith('No text anywhere in the image.'), 'el cierre va lo último');
  assert.ok(ultimo.lastIndexOf('FINAL CHECK') > ultimo.indexOf('Scene to show:'));
  assert.ok(!/\bnipples?\b/i.test(ultimo));
});

// ─── Voces, música, subtítulos y montaje ───
const { pcmAWav, duracionWav } = require('../api/_lib/audio');
const hojaLib = require('../api/_lib/hoja');
const pedirA = (ruta, body, method = 'POST') => peticion({ method, url: ruta, headers: { cookie: acceso.COOKIE + '=' + token() }, body });
function mundoGoogle(manejar) {
  const subidos = {}, vistas = [];
  google_responde = async (url, opciones = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'ya29.servicio', expires_in: 3600 }));
    if (url.includes('/upload/storage/v1/')) { subidos[new URL(url).searchParams.get('name')] = Buffer.from(opciones.body).toString('utf8'); return new Response(JSON.stringify({ generation: '9' })); }
    vistas.push({ url, cuerpo: opciones.body ? JSON.parse(opciones.body) : null });
    return manejar(url, opciones);
  };
  return { subidos, vistas };
}
const WAV = pcmAWav(Buffer.alloc(48000 * 2)); // 2 s a 24 kHz

test('audio: el PCM se envuelve en WAV y su duración se lee de la cabecera', () => {
  assert.equal(duracionWav(WAV), 2);
  assert.equal(duracionWav(Buffer.from('no es un wav')), null);
});

test('voz: las voces se piden a Google (con su género) y un tramo de dos hablantes va en UNA llamada', async () => {
  conCuentaDeServicio();
  process.env.GCS_OUTPUT_BUCKET = 'bucket-prueba';
  const voz = require('../api/voz');
  let { vistas } = mundoGoogle(url => url.startsWith('https://texttospeech.googleapis.com/v1/voices')
    ? new Response(JSON.stringify({ voices: [{ name: 'es-US-Chirp3-HD-Kore', ssmlGender: 'FEMALE' }, { name: 'es-US-Chirp3-HD-Charon', ssmlGender: 'MALE' }, { name: 'es-US-Neural2-A', ssmlGender: 'FEMALE' }] }))
    : new Response('{}', { status: 500 }));
  const lista = respuesta();
  await voz(pedirA('/api/voz', null, 'GET'), lista);
  assert.equal(lista.statusCode, 200, JSON.stringify(lista.valor));
  assert.deepEqual(lista.valor.voces, [{ nombre: 'Charon', genero: 'hombre' }, { nombre: 'Kore', genero: 'mujer' }]);
  const pcm = Buffer.alloc(24000 * 2 * 3).toString('base64');
  ({ vistas } = mundoGoogle(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }] }))));
  const salida = respuesta();
  await voz(pedirA('/api/voz', { proyecto: 'pimagen0001', clave: 'voz-e1-1', registro: 'dramatica', hablantes: [{ voz: 'Charon' }, { voz: 'Kore' }],
    lineas: [{ hablante: 0, texto: '¡Arrodíllate!' }, { hablante: 1, texto: 'Nunca.' }, { hablante: 0, texto: 'Ya verás.', pensamiento: true }] }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  assert.equal(salida.valor.segundos, 3);
  assert.equal(salida.valor.ruta, base + 'voz-e1-1.wav');
  assert.equal(vistas.length, 1, 'los dos hablantes en la misma llamada');
  assert.match(vistas[0].url, /\/v1beta1\/projects\/.*\/models\/gemini-2\.5-flash-preview-tts:generateContent$/);
  const cuerpo = vistas[0].cuerpo;
  assert.deepEqual(cuerpo.generationConfig.speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs.map(s => s.voiceConfig.prebuiltVoiceConfig.voiceName), ['Charon', 'Kore']);
  const texto = cuerpo.contents[0].parts[0].text;
  assert.ok(texto.startsWith(voz.instruccion('dramatica')), 'la misma instrucción de estilo en todas las llamadas');
  assert.match(texto, /Speaker1: ¡Arrodíllate!\nSpeaker2: Nunca\.\nSpeaker1: \(inner thought\) Ya verás\./);
  const tres = respuesta();
  await voz(pedirA('/api/voz', { proyecto: 'pimagen0001', clave: 'voz-e1-1', hablantes: [{ voz: 'Charon' }, { voz: 'Kore' }, { voz: 'Puck' }], lineas: [{ texto: 'x' }] }), tres);
  assert.equal(tres.statusCode, 400);
});

test('música: un brief en español se rechaza antes de llamar a Lyria; en inglés se guarda en el bucket', async () => {
  conCuentaDeServicio();
  process.env.GCS_OUTPUT_BUCKET = 'bucket-prueba';
  const musica = require('../api/musica');
  const { vistas } = mundoGoogle(() => new Response(JSON.stringify({ predictions: [{ bytesBase64Encoded: WAV.toString('base64'), mimeType: 'audio/wav' }] })));
  const mal = respuesta();
  await musica(pedirA('/api/musica', { proyecto: 'pimagen0001', clave: 'musica-ep1-1', brief: 'Música épica con tambores y guzheng para la revancha del héroe.' }), mal);
  assert.equal(mal.statusCode, 400);
  assert.equal(vistas.length, 0);
  const bien = respuesta();
  await musica(pedirA('/api/musica', { proyecto: 'pimagen0001', clave: 'musica-ep1-1', brief: 'Tense cinematic score with taiko drums, guzheng and low strings, building to a triumphant brass fanfare.' }), bien);
  assert.equal(bien.statusCode, 200, JSON.stringify(bien.valor));
  assert.equal(bien.valor.segundos, 2);
  assert.match(vistas[0].url, /us-central1-aiplatform.*lyria-002:predict$/);
  assert.match(vistas[0].cuerpo.instances[0].negative_prompt, /vocals, singing/);
});

test('transcripción: lee la voz del bucket y devuelve los tiempos de cada palabra', async () => {
  conCuentaDeServicio();
  const transcripcion = require('../api/transcripcion');
  const { vistas } = mundoGoogle(url => url.includes('alt=media')
    ? new Response(WAV, { headers: { 'content-type': 'audio/wav' } })
    : new Response(JSON.stringify({ results: [{ alternatives: [{ words: [{ word: 'arrodíllate', startTime: '0.2s', endTime: '0.9s' }, { word: 'inútil', startTime: { seconds: 1, nanos: 100000000 }, endTime: '1.6s' }] }] }] })));
  const salida = respuesta();
  await transcripcion(pedirA('/api/transcripcion', { proyecto: 'pimagen0001', ruta: base + 'voz-e1-1.wav' }), salida);
  assert.equal(salida.statusCode, 200, JSON.stringify(salida.valor));
  assert.deepEqual(salida.valor.palabras, [{ palabra: 'arrodíllate', inicio: 0.2, fin: 0.9 }, { palabra: 'inútil', inicio: 1.1, fin: 1.6 }]);
  const stt = vistas.find(v => v.url.includes('speech:recognize')).cuerpo;
  assert.equal(stt.config.model, 'latest_long');
  assert.equal(stt.config.languageCode, 'es-US');
  assert.equal(stt.config.enableWordTimeOffsets, true);
  const ajena = respuesta();
  await transcripcion(pedirA('/api/transcripcion', { proyecto: 'pimagen0001', ruta: 'drama-studio/proyectos/potro00001/medios/x.wav' }), ajena);
  assert.equal(ajena.statusCode, 400);
});

const hojaPrueba = () => ({ modo: 'video', episodio: 1, formato: '9:16',
  planos: [{ tipo: 'video', ruta: base + 'plano-e1-1.mp4', duracion: 4, sistema: 'Misión cumplida. $(rm -rf /) `x`' }, { tipo: 'imagen', ruta: base + 'plano-e1-2.png', duracion: 2.5 }],
  voces: [{ ruta: base + 'voz-e1-1.wav', inicio: 0.35 }], musica: [{ ruta: base + 'musica-ep1-1.wav', inicio: 0, duracion: 6.5 }],
  subtitulos: [{ inicio: 0.35, fin: 2, texto: "Hola'; rm -rf / #" }] });

test('hoja de montaje: el guion lo escribe el servidor, es bash válido y ningún texto del navegador entra en él', () => {
  const h = hojaLib.validar('pimagen0001', hojaPrueba());
  const { script, descargas, textos, archivo } = hojaLib.construir(h, { bucket: 'b', carpeta: 'drama-studio/proyectos/pimagen0001/montaje/video-ep01' });
  assert.equal(archivo, 'episodio-01.mp4');
  assert.ok(!script.includes('rm -rf'), 'los textos viajan como archivos, no dentro del guion');
  assert.ok(textos.some(([r, c]) => r.endsWith('/t/s0001.txt') && c.includes('Misión cumplida.')));
  assert.ok(textos.some(([r, c]) => r.endsWith('/episodio.srt') && c.includes('00:00:00,350 --> 00:00:02,000')));
  assert.deepEqual(descargas[0], ['gs://b/' + base + 'plano-e1-1.mp4', 'm/p0001.mp4']);
  assert.match(script, /segmento_video m\/p0001\.mp4 seg\/s0001\.mp4 4\.000 t\/s0001\.txt/);
  assert.match(script, /segmento_imagen m\/p0002\.png seg\/s0002\.mp4 2\.500 1 -/);
  assert.match(script, /setpts=\$\{f\}\*PTS,tpad=stop_mode=clone/, 'se retima, no se repite ni se recorta');
  assert.match(script, /x=d\/r; if \(x>3\) x=3/, 'ralentizar como mucho 3×');
  assert.match(script, /loudnorm=I=-16/);
  assert.match(script, /subtitles=episodio\.srt/);
  const ruta = path.join(require('node:os').tmpdir(), 'montar-prueba.sh');
  fs.writeFileSync(ruta, script);
  assert.equal(require('node:child_process').spawnSync('bash', ['-n', ruta]).status, 0, 'el guion es un shell válido');
  for (const [romper, que] of [[x => { x.planos[0].ruta = 'drama-studio/proyectos/potro00001/medios/a.mp4'; }, 'ruta ajena'], [x => { x.planos[0].duracion = -1; }, 'duración'], [x => { x.planos = []; }, 'sin planos']]) {
    const malo = hojaPrueba(); romper(malo);
    assert.throws(() => hojaLib.validar('pimagen0001', malo), undefined, que);
  }
  const zip = hojaLib.validar('pimagen0001', { modo: 'zip', episodio: 2, archivos: [{ ruta: base + 'plano-e1-2.png', nombre: 'imagenes/escena-01-plano-02.png' }], textos: [{ nombre: 'guion.txt', contenido: 'x' }] });
  assert.equal(hojaLib.construir(zip, { bucket: 'b', carpeta: 'c' }).archivo, 'material-ep02.zip');
  assert.throws(() => hojaLib.validar('pimagen0001', { modo: 'zip', episodio: 1, archivos: [{ ruta: base + 'a.png', nombre: '../../etc/passwd' }] }));
});

test('montaje: sube el trabajo, lanza el montador con su carpeta y salida, y consulta hasta tenerlo; un fallo trae su motivo', async () => {
  conCuentaDeServicio();
  process.env.GCS_OUTPUT_BUCKET = 'bucket-prueba';
  const montaje = require('../api/montaje');
  const OP = 'projects/proyecto-prueba/locations/us-central1/operations/abc-123';
  let { subidos, vistas } = mundoGoogle(url => url.includes(':run') ? new Response(JSON.stringify({ name: OP })) : new Response('{}', { status: 500 }));
  const inicio = respuesta();
  await montaje(pedirA('/api/montaje', { accion: 'iniciar', proyecto: 'pimagen0001', hoja: hojaPrueba() }), inicio);
  assert.equal(inicio.statusCode, 200, JSON.stringify(inicio.valor));
  assert.equal(inicio.valor.operacion, OP);
  assert.equal(inicio.valor.ruta, base + 'episodio-01.mp4');
  const carpeta = 'drama-studio/proyectos/pimagen0001/montaje/video-ep01';
  assert.equal(inicio.valor.carpeta, carpeta);
  assert.ok(subidos[carpeta + '/montar.sh'].startsWith('#!/usr/bin/env bash'));
  assert.ok(subidos[carpeta + '/descargas.txt'].endsWith('\n'), 'la lista termina en salto de línea');
  assert.equal(subidos[carpeta + '/error.txt'], '');
  const lanzar = vistas.find(v => v.url.includes(':run'));
  assert.match(lanzar.url, /\/locations\/us-central1\/jobs\/drama-studio-montage:run$/);
  const env = Object.fromEntries(lanzar.cuerpo.overrides.containerOverrides[0].env.map(e => [e.name, e.value]));
  assert.deepEqual(env, { TRABAJO: 'gs://bucket-prueba/' + carpeta, SALIDA: 'gs://bucket-prueba/' + base + 'episodio-01.mp4', ARCHIVO: 'episodio-01.mp4' });
  // Consulta: aún no; luego listo con URL de descarga; luego un fallo con su motivo.
  for (const [respuestaRun, esperado] of [[{ done: false }, 'nolisto'], [{ done: true, response: {} }, 'listo'], [{ done: true, error: { message: 'exit code 1' } }, 'fallo']]) {
    mundoGoogle(url => url.startsWith('https://run.googleapis.com/v2/' + OP) ? new Response(JSON.stringify(respuestaRun)) : url.includes('error.txt') ? new Response('ffmpeg: no se pudo leer m/p0001.mp4') : new Response('{}', { status: 404 }));
    const estado = respuesta();
    await montaje(pedirA('/api/montaje', { accion: 'estado', proyecto: 'pimagen0001', operacion: OP, carpeta, ruta: base + 'episodio-01.mp4' }), estado);
    if (esperado === 'nolisto') assert.equal(estado.valor.listo, false);
    if (esperado === 'listo') { assert.equal(estado.valor.listo, true); assert.match(estado.valor.url, /response-content-disposition=/); }
    if (esperado === 'fallo') { assert.equal(estado.statusCode, 502); assert.equal(estado.valor.tipo, 'montaje_fallo'); assert.match(estado.valor.detalleGoogle || estado.valor.error, /no se pudo leer/); }
  }
  // Sin montador desplegado: se dice que hay que ejecutar el instalador.
  mundoGoogle(url => url.includes(':run') ? new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }) : new Response('{}'));
  const sin = respuesta();
  await montaje(pedirA('/api/montaje', { accion: 'iniciar', proyecto: 'pimagen0001', hoja: hojaPrueba() }), sin);
  assert.equal(sin.statusCode, 502);
  assert.match(sin.valor.error, /Ejecuta el instalador/);
  // Una carpeta de otro proyecto no se consulta.
  const otra = respuesta();
  await montaje(pedirA('/api/montaje', { accion: 'estado', proyecto: 'pimagen0001', operacion: OP, carpeta: 'drama-studio/proyectos/potro00001/montaje/video-ep01', ruta: base + 'episodio-01.mp4' }), otra);
  assert.equal(otra.statusCode, 400);
});
