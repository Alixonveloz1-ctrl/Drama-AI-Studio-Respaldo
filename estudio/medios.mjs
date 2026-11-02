// ════════════════════════════════════════════════════════════════
// MEDIOS (navegador) — generar imágenes y verlas.
//
// Cola de la sección 18:
//  · Nada en paralelo: un elemento a la vez.
//  · Un 429 es una espera: 60, 120, 180, 240 y 300 s, con cuenta atrás.
//  · Un bloqueo sale a la primera y se dice (reintentarlo lo vuelve a
//    bloquear y gasta cuota de verdad).
//  · Un elemento que falla no tumba la tanda: se cuenta y se sigue.
//  · «Detener» corta de verdad, también en mitad de una espera de minutos.
// ════════════════════════════════════════════════════════════════
import { llamar, explicar } from './red.mjs';
import { esBloqueo, esCuota, errorDetenido } from './texto.mjs';

export const ESPERAS_CUOTA_MEDIOS = [60, 120, 180, 240, 300];

async function esperar(segundos, control, aviso, motivo) {
  for (let restante = segundos * 4; restante > 0; restante--) {
    if (control?.detenido) throw errorDetenido();
    if (restante % 4 === 0) {
      const s = restante / 4;
      aviso?.(`${motivo} Reintento en ${s >= 60 ? Math.floor(s / 60) + ' min ' + (s % 60) + ' s' : s + ' s'}.`);
    }
    await new Promise(listo => setTimeout(listo, 250));
  }
}

// Una petición de medios con la política de esperas de imagen y video.
export async function pedirMedio(ruta, cuerpo, { control, aviso } = {}) {
  let cuota = 0, pasajero = 0;
  for (;;) {
    if (control?.detenido) throw errorDetenido();
    try {
      return await llamar(ruta, { metodo: 'POST', cuerpo, senal: control?.abortador.signal });
    } catch (e) {
      if (e.detenido || control?.detenido) throw errorDetenido();
      if (esBloqueo(e)) throw e;
      if (esCuota(e) && cuota < ESPERAS_CUOTA_MEDIOS.length) {
        await esperar(ESPERAS_CUOTA_MEDIOS[cuota++], control, aviso, 'Google pide esperar por el límite por minuto de tu cuenta.');
        continue;
      }
      if ((e.reintentable || e.tipo === 'tiempo') && pasajero < 2) {
        await esperar(pasajero++ ? 15 : 5, control, aviso, 'Hubo un corte pasajero.');
        continue;
      }
      throw e;
    }
  }
}

// ─── Tanda: uno a uno, saltando lo hecho, contando fallos ───
export async function tanda(elementos, { hacer, yaHecho = () => false, control, aviso, alAvanzar }) {
  const cuenta = { generados: 0, existian: 0, fallidos: 0, bloqueados: 0, errores: [] };
  for (let i = 0; i < elementos.length; i++) {
    if (control?.detenido) throw Object.assign(errorDetenido(), { cuenta });
    const el = elementos[i];
    if (yaHecho(el)) { cuenta.existian++; continue; }
    try {
      await hacer(el, { control, aviso: t => aviso?.(`${i + 1} de ${elementos.length} · ${t}`) });
      cuenta.generados++;
    } catch (e) {
      if (e.detenido) throw Object.assign(e, { cuenta });
      if (esBloqueo(e)) cuenta.bloqueados++;
      cuenta.fallidos++;
      cuenta.errores.push({ elemento: el, texto: explicar(e) });
    }
    alAvanzar?.(cuenta);
  }
  return cuenta;
}

export function resumenTanda(c) {
  const partes = [`${c.generados} generadas`];
  if (c.existian) partes.push(`${c.existian} ya existían`);
  if (c.fallidos) partes.push(`${c.fallidos} fallaron${c.bloqueados ? ` (${c.bloqueados} bloqueadas por Google)` : ''}`);
  return partes.join(' · ');
}

// ─── URLs firmadas para ver los medios (caducan; se piden de nuevo) ───
const cache = new Map();   // ruta → { url, caduca }
export function recordarUrl(ruta, url) {
  cache.set(ruta, { url, caduca: Date.now() + 5.5 * 3600 * 1000 });
}
export async function urlsDe(proyecto, rutas) {
  const faltan = [...new Set(rutas.filter(r => r && !(cache.get(r)?.caduca > Date.now())))];
  if (faltan.length) {
    const { urls } = await llamar('/api/urls', { metodo: 'POST', cuerpo: { proyecto, ver: faltan } });
    for (const [ruta, url] of Object.entries(urls || {})) recordarUrl(ruta, url);
  }
  return Object.fromEntries(rutas.map(r => [r, cache.get(r)?.url]));
}

// Pone la URL a cada <img data-ruta> de un contenedor.
export async function cargarImagenes(contenedor, proyecto) {
  const imagenes = [...contenedor.querySelectorAll('img[data-ruta]')];
  if (!imagenes.length || !proyecto) return;
  try {
    const urls = await urlsDe(proyecto, imagenes.map(i => i.dataset.ruta));
    for (const img of imagenes) if (urls[img.dataset.ruta] && img.src !== urls[img.dataset.ruta]) img.src = urls[img.dataset.ruta];
  } catch (e) {
    for (const img of imagenes) img.closest('.marco')?.setAttribute('data-error', 'No se pudo cargar la imagen: ' + explicar(e));
  }
}
