// ════════════════════════════════════════════════════════════════
// RED — una sola forma de hablar con los endpoints del estudio.
// Todo error sale con palabras (error.message), su tipo (cuota, bloqueo,
// tiempo, conflicto…) y, si lo hay, el mensaje de Google tal cual.
// ════════════════════════════════════════════════════════════════

export class ErrorRed extends Error {
  constructor(mensaje, extra = {}) {
    super(mensaje);
    Object.assign(this, extra);
  }
}

export async function llamar(ruta, { metodo = 'GET', cuerpo, senal } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: senal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw new ErrorRed('Detenido.', { detenido: true });
    throw new ErrorRed('No hay conexión con el estudio. Comprueba la red; se volverá a intentar.', { tipo: 'red', reintentable: true });
  }
  const crudo = await respuesta.text();
  let datos;
  try {
    datos = crudo ? JSON.parse(crudo) : {};
  } catch {
    // El 504 propio de Vercel llega en texto plano: la petición no cupo en
    // 60 s. Repetirla igual solo repite el corte; hay que hacerla más pequeña.
    if (respuesta.status === 504 || /FUNCTION_INVOCATION_TIMEOUT/.test(crudo)) {
      throw new ErrorRed('El servidor se quedó sin tiempo para esta petición. Hay que hacerla más pequeña.', { tipo: 'tiempo', status: 504 });
    }
    throw new ErrorRed(`El estudio respondió algo que no se entiende (código ${respuesta.status}).`, { status: respuesta.status, reintentable: respuesta.status >= 500 });
  }
  if (!respuesta.ok) {
    throw new ErrorRed(datos.error || `El estudio respondió con un error (código ${respuesta.status}).`, {
      status: respuesta.status,
      tipo: datos.tipo || (respuesta.status === 429 ? 'cuota' : undefined),
      detalleGoogle: datos.detalleGoogle,
      reintentable: respuesta.status >= 500 && datos.tipo !== 'bloqueo' && datos.tipo !== 'configuracion' && datos.tipo !== 'tiempo',
    });
  }
  return datos;
}

// Texto para el usuario: la explicación y, debajo, lo que dijo Google.
export function explicar(error) {
  if (!error) return '';
  return error.detalleGoogle ? `${error.message}\nGoogle: ${error.detalleGoogle}` : error.message;
}
