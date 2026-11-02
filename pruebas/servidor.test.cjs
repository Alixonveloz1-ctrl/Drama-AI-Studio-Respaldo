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
