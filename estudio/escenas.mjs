// ════════════════════════════════════════════════════════════════
// ESCENAS — los planos con sus imágenes (sección 19).
//
//  · Cada plano tiene a la vista «Generar imagen». Lo generado queda en uso
//    de inmediato.
//  · «Generar todas las imágenes» recorre los planos sin imagen, uno a uno,
//    en orden (cada plano usa el anterior como referencia de continuidad).
//  · Una toma con un personaje recurrente se bloquea si falta su ficha: así
//    no cambia de cara entre planos.
//  · Cada plano tiene también «Generar video» (arranca de su imagen) y
//    «Generar todos los videos» recorre los planos de acción sin clip. Una
//    operación de Veo ya arrancada se guarda y se sigue tras recargar.
//  · El dueño revisa después, mirando el resultado, y regenera lo que salió
//    mal con el botón del plano.
// ════════════════════════════════════════════════════════════════
import { proyectoActual, guardar } from './proyectos.mjs';
import { pedirMedio, tanda, resumenTanda, cargarImagenes, recordarUrl } from './medios.mjs';
import { desglosar, revisar, escenasDelEpisodio, textoEscena } from './desglose.mjs';
import { modeloImagen, MODELOS_IMAGEN } from './personajes.mjs';
import { videoPlano, modeloVideo, MODELOS_VIDEO } from './videos.mjs';
import { crearControl } from './texto.mjs';
import { segundosDe } from './prompts.mjs';
import { contarPalabras } from './guion.mjs';
import { explicar } from './red.mjs';
import { escapar, avisar, verImagen } from './interfaz.mjs';

let raiz = null;
let ocupado = null;
let ultimoError = null;
let informe = null;   // último informe del director de arte
let fila = Promise.resolve();

export function montarEscenas(contenedor) {
  raiz = contenedor;
  raiz.addEventListener('click', alPulsar);
  // Selectores de modelo (plegados): se guardan en el proyecto.
  raiz.addEventListener('change', evento => {
    const campo = evento.target.closest('[name="modeloImagen"], [name="modeloVideo"]');
    const d = proyectoActual()?.datos;
    if (!campo || !d) return;
    d.ajustes = { ...(d.ajustes || {}), [campo.name]: campo.value };
    guardar().catch(e => avisar(explicar(e), 'error'));
  });
}

export function pintarEscenas() {
  fila = fila.then(() => new Promise(listo => requestAnimationFrame(() => { pintarAhora(); listo(); })));
  return fila;
}

const caja = donde => (ultimoError?.donde === donde ? `<div class="caja-error" role="alert">${escapar(ultimoError.texto).replace(/\n/g, '<br>')}</div>` : '')
  + (ocupado?.donde === donde ? `<div class="progreso-caja"><div class="progreso-linea"><span class="spinner"></span><span class="aviso-vivo">${escapar(ocupado.aviso || 'Trabajando…')}</span></div>
      <button type="button" class="btn-sec" data-accion="detener" data-libre="1">Detener</button></div>` : '');

function datos() {
  const p = proyectoActual();
  const d = p?.datos;
  const numero = d?.episodioActual || 1;
  return { p, d, numero, ep: d?.episodios?.[numero] };
}

function fichaDe(u, id) {
  const v = (u.variantes || []).find(x => x.id === id);
  if (v) return { nombre: v.nombre, ruta: v.referencia?.ruta, obsoleta: v.obsoleta };
  const x = u.personajes.find(p => p.id === id);
  return { nombre: x?.nombre || id, ruta: x?.referencia?.ruta };
}

const conPunto = t => /[.!?…]$/.test(t) ? t : t + '.';

function pintarAhora() {
  if (!raiz) return;
  const { p, d, ep } = datos();
  if (ep?.estado !== 'completo') {
    raiz.innerHTML = `<div class="seccion"><h3>Escenas</h3></div><div class="card"><div class="empty">
      <svg class="icono"><use href="#i-pelicula"/></svg><p>Primero termina el guion en Historia: las escenas salen de él.</p></div></div>`;
    return;
  }
  const u = d.universo;
  const escenas = escenasDelEpisodio(d, d.episodioActual || 1);
  const planos = escenas.flatMap(e => e.planos || []);
  const sinDesglose = escenas.filter(e => !e.planos?.length).length;
  const sinImagen = planos.filter(x => !x.imagen || x.imagenObsoleta).length;
  const deAccion = planos.filter(x => x.tipo === 'accion');
  const sinVideo = deAccion.filter(x => !x.video || x.videoObsoleto).length;
  const conVideo = planos.filter(x => x.video && !x.videoObsoleto).length;
  const enCurso = planos.filter(x => x.operacion?.nombre).length;
  const fichasQueFaltan = u.personajes.filter(x => !x.referencia).map(x => x.nombre);
  const accion = planos.filter(x => x.tipo === 'accion').length;
  const vertical = d.formulario.formato !== '16:9';
  raiz.innerHTML = `
  <div class="seccion"><h3>Escenas</h3></div>
  <div class="card">
    ${fichasQueFaltan.length ? `<div class="caja-error">Faltan las fichas de ${escapar(fichasQueFaltan.join(', '))}. Sin ellas no se generan los planos donde aparecen.
      <button type="button" class="btn-sec" data-accion="ir-personajes">Ir a Personajes</button></div>` : ''}
    <p class="nota">${escenas.length} escenas · ${planos.length} planos${planos.length ? ` (${Math.round(100 * accion / planos.length)} % de acción) · ${planos.length - sinImagen} con imagen · ${conVideo} con video` : ''}</p>
    ${enCurso && !ocupado ? `<p class="nota oro">Hay ${enCurso} video(s) que Veo ya estaba haciendo: pulsa «Generar todos los videos» o el botón del plano para seguirlos sin pagar otro.</p>` : ''}
    ${informe ? `<p class="nota">${escapar(informe)}</p>` : ''}
    ${caja('general')}
    ${sinDesglose ? `<button type="button" class="btn ancho" data-accion="desglose">${planos.length ? `Desglosar las ${sinDesglose} escenas que faltan` : 'Hacer el desglose de planos'}</button>` : ''}
    ${!sinDesglose && sinImagen ? `<button type="button" class="btn ancho" data-accion="lote">Generar todas las imágenes (${sinImagen})</button>` : ''}
    ${!sinDesglose && sinVideo ? `<button type="button" class="${sinImagen ? 'btn-sec' : 'btn ancho'}" data-accion="lote-videos">Generar todos los videos (${sinVideo})</button>` : ''}
    ${!sinDesglose && !sinImagen && !sinVideo ? `<p class="nota oro">Todas las imágenes y los videos de acción están hechos.</p>` : ''}
    ${planos.length ? `<button type="button" class="btn-sec" data-accion="revisar">Revisar la puesta en escena</button>` : ''}
    <details class="plegado"><summary>Modelos de imagen y video</summary>
      <label class="campo-linea">Modelo de imagen<select name="modeloImagen">${MODELOS_IMAGEN.map(m => `<option value="${m.valor}"${m.valor === modeloImagen(d) ? ' selected' : ''}>${m.etiqueta}</option>`).join('')}</select></label>
      <label class="campo-linea">Modelo de video<select name="modeloVideo">${MODELOS_VIDEO.map(m => `<option value="${m.valor}"${m.valor === modeloVideo(d) ? ' selected' : ''}>${m.etiqueta}</option>`).join('')}</select></label>
    </details>
  </div>
  ${escenas.map((e, n) => {
    const lugar = u.escenarios.find(x => x.id === e.escenario)?.nombre || '';
    const seg = Math.round(segundosDe(contarPalabras(textoEscena(e))));
    return `<details class="card escena-planos"${n === 0 ? ' open' : ''}>
      <summary><span class="escena-num">Escena ${n + 1}</span> ${escapar(e.titulo)} <span class="nota">· ${escapar(lugar)} · ≈ ${seg} s${e.planos?.length ? ` · ${e.planos.length} planos` : ''}</span></summary>
      <div class="lineas-compactas">${e.lineas.map(l => `<p><strong>${escapar(l.tipo === 'sistema' ? 'Sistema' : l.personaje === 'extra' ? (l.nombre || 'Extra') : fichaDe(u, l.personaje).nombre)}:</strong> ${escapar(l.texto)}</p>`).join('')}</div>
      ${caja('e-' + e.id)}
      <div class="planos">${(e.planos || []).map((x, i) => `
        <div class="plano${vertical ? ' lado' : ''}">
          <div class="marco ${vertical ? 'vertical' : 'horizontal'}">${x.video ? `<video data-ruta="${escapar(x.video.ruta)}"${x.imagen ? ` data-portada="${escapar(x.imagen.ruta)}"` : ''} controls playsinline preload="metadata"></video>` : x.imagen ? `<img data-ruta="${escapar(x.imagen.ruta)}" alt="Plano ${i + 1}" data-ver="1">` : `<span>Plano ${i + 1}</span>`}</div>
          <div class="plano-datos">
            <span class="etiqueta ${x.tipo === 'accion' ? 'propio' : 'defecto'}">${x.tipo === 'accion' ? 'Acción · 4 s' : 'Cobertura · 1,5–3 s'}</span>
            <span class="nota">peso ${x.peso}${x.personajes.length ? ' · ' + escapar(x.personajes.map(id => fichaDe(u, id).nombre).join(', ')) : ''}</span>
            <p class="ancla">«${escapar(x.ancla)}»</p>
            ${x.sistema ? `<p class="linea sistema"><span class="quien">Sistema</span>${escapar(x.sistema)}</p>` : ''}
            ${x.revision ? `<p class="aviso-obsoleta">Director de arte: ${escapar(conPunto(x.revision))}${x.imagenObsoleta ? ' La imagen quedó obsoleta.' : ''}</p>` : ''}
            ${caja('p-' + x.id)}
            ${x.video && x.videoObsoleto ? `<p class="aviso-obsoleta">El video es de una imagen anterior.</p>` : ''}
            <button type="button" class="${x.imagen && !x.imagenObsoleta ? 'btn-sec' : 'btn ancho'}" data-accion="imagen" data-escena="${e.id}" data-plano="${i}">${x.imagen ? 'Regenerar imagen' : 'Generar imagen'}</button>
            ${x.imagen && !x.imagenObsoleta ? `<button type="button" class="${x.video && !x.videoObsoleto ? 'btn-sec' : 'btn ancho'}" data-accion="video" data-escena="${e.id}" data-plano="${i}">${x.operacion?.nombre ? 'Seguir el video en curso' : x.video ? 'Regenerar video' : 'Generar video'}</button>` : ''}
            <details class="plegado"><summary>Ver el prompt</summary><p class="corto">${escapar(x.prompt)}</p>${x.movimiento ? `<p class="corto">Movimiento: ${escapar(x.movimiento)}</p>` : ''}</details>
          </div>
        </div>`).join('')}</div>
      ${e.planos?.length ? `<button type="button" class="btn-sec" data-accion="redesglose" data-escena="${e.id}">Rehacer el desglose de esta escena</button>` : ''}
    </details>`;
  }).join('')}`;
  raiz.querySelectorAll('[data-accion]').forEach(b => { if (ocupado && !b.dataset.libre) b.disabled = true; });
  cargarImagenes(raiz, p.id);
}

function aviso(texto) {
  if (!ocupado) return;
  ocupado.aviso = texto;
  raiz.querySelectorAll('.aviso-vivo').forEach(s => { s.textContent = texto; });
}

async function imagenPlano(escena, indice, opciones) {
  const { p, d } = datos();
  const u = d.universo;
  const plano = escena.planos[indice];
  const personajes = plano.personajes.map(id => fichaDe(u, id));
  const falta = personajes.find(x => !x.ruta);
  if (falta) throw new Error(`Falta la ficha de ${falta.nombre}. Genérala en Personajes: sin ella este plano no se genera, para no cambiarle la cara.`);
  const anterior = escena.planos[indice - 1];
  const cuerpo = {
    proyecto: p.id, clave: 'plano-' + plano.id, prompt: plano.prompt, formato: d.formulario.formato, modelo: modeloImagen(d),
    personajes: personajes.map(x => ({ nombre: x.nombre, ruta: x.ruta })),
    continuidad: anterior?.imagen?.ruta || undefined,
    escenario: u.escenarios.find(x => x.id === escena.escenario)?.referencia?.ruta || undefined,
    ecchi: (d.formulario.subgeneros || []).some(s => ['ecchi', 'harem', 'harem_inverso'].includes(s)),
  };
  const r = await pedirMedio('/api/imagen', cuerpo, opciones);
  recordarUrl(r.ruta, r.url);
  for (const a of r.avisos || []) avisar(a);
  plano.imagen = { ruta: r.ruta, modelo: r.modelo, fecha: Date.now() };
  plano.imagenObsoleta = false;
  if (plano.video) plano.videoObsoleto = true;
  await guardar();
}

async function trabajar(donde, tarea) {
  const control = crearControl();
  ocupado = { donde, control, aviso: 'Trabajando…' };
  ultimoError = null;
  await pintarEscenas();
  try {
    const mensaje = await tarea({ control, aviso, guardar: () => guardar() });
    if (mensaje) avisar(mensaje, 'success');
  } catch (e) {
    ultimoError = { donde, texto: e.detenido ? e.message + (e.cuenta ? ' ' + resumenTanda(e.cuenta) + '.' : '') : explicar(e) };
    if (!e.detenido) avisar(e.message, 'error');
  } finally {
    ocupado = null;
    await pintarEscenas();
  }
}

function textoInforme(r) {
  const partes = [];
  if (r.revisadas) partes.push(`El director de arte revisó ${r.revisadas} escena(s)${r.correcciones ? ` y corrigió ${r.correcciones} plano(s); las imágenes afectadas quedan marcadas como obsoletas` : ' y no encontró fallos en ellas'}.`);
  if (r.sinRevisar.length) partes.push(`No pudo revisar ${r.sinRevisar.length} escena(s) (posible límite de peticiones): no se da por buenas.`);
  return partes.join(' ');
}

async function alPulsar(evento) {
  const img = evento.target.closest('img[data-ver]');
  if (img?.src) { verImagen(img.src, img.alt); return; }
  const boton = evento.target.closest('[data-accion]');
  if (!boton || boton.disabled) return;
  const accion = boton.dataset.accion;
  if (accion === 'detener') { ocupado?.control.detener(); return; }
  if (ocupado) return;
  const { d, numero } = datos();
  if (!d) return;
  if (accion === 'ir-personajes') { document.dispatchEvent(new CustomEvent('ir-a', { detail: 'personajes' })); return; }
  const escenas = escenasDelEpisodio(d, numero);
  if (accion === 'desglose') {
    return trabajar('general', async o => {
      const r = await desglosar(d, numero, { ...o, alAvanzar: () => pintarEscenas() });
      informe = textoInforme(r);
      return 'Desglose listo.';
    });
  }
  if (accion === 'redesglose') {
    const id = boton.dataset.escena;
    return trabajar('e-' + id, async o => {
      const r = await desglosar(d, numero, { ...o, soloEscena: id });
      informe = textoInforme(r);
      return 'Desglose de la escena rehecho.';
    });
  }
  if (accion === 'revisar') {
    return trabajar('general', async o => {
      const total = { revisadas: 0, correcciones: 0, sinRevisar: [] };
      const conPlanos = escenas.filter(e => e.planos?.length);
      for (let i = 0; i < conPlanos.length; i += 5) {
        try {
          const r = await revisar(d, conPlanos.slice(i, i + 5), o);
          total.revisadas += r.revisadas; total.correcciones += r.correcciones; total.sinRevisar.push(...r.sinRevisar);
        } catch (e) {
          if (e.detenido) throw e;
          total.sinRevisar.push(...conPlanos.slice(i, i + 5).map(x => x.id));
        }
      }
      informe = textoInforme(total);
      return 'Revisión terminada.';
    });
  }
  if (accion === 'imagen') {
    const escena = escenas.find(e => e.id === boton.dataset.escena);
    const indice = Number(boton.dataset.plano);
    return trabajar('p-' + escena.planos[indice].id, async o => { await imagenPlano(escena, indice, o); return 'Imagen lista.'; });
  }
  if (accion === 'video') {
    const escena = escenas.find(e => e.id === boton.dataset.escena);
    const plano = escena.planos[Number(boton.dataset.plano)];
    return trabajar('p-' + plano.id, async o => {
      await videoPlano({ proyectoId: proyectoActual().id, datos: d, escena, plano, ...o });
      return 'Video listo.';
    });
  }
  if (accion === 'lote-videos') {
    return trabajar('general', async o => {
      const elementos = escenas.flatMap(e => (e.planos || []).filter(x => x.tipo === 'accion').map(x => ({ escena: e, plano: x })));
      const cuenta = await tanda(elementos, {
        ...o,
        palabra: 'generados',
        yaHecho: el => Boolean(el.plano.video) && !el.plano.videoObsoleto && !el.plano.operacion,
        hacer: (el, op) => { op.aviso(`plano ${el.plano.id}…`); return videoPlano({ proyectoId: proyectoActual().id, datos: d, escena: el.escena, plano: el.plano, control: op.control, aviso: t => op.aviso(`plano ${el.plano.id} · ${t}`), guardar: o.guardar }); },
        alAvanzar: () => pintarEscenas(),
      });
      if (cuenta.fallidos) ultimoError = { donde: 'general', texto: resumenTanda(cuenta) + '.\n' + cuenta.errores.map(e => `Plano ${e.elemento.plano.id}: ${e.texto}`).join('\n') };
      return resumenTanda(cuenta) + '.';
    });
  }
  if (accion === 'lote') {
    return trabajar('general', async o => {
      const elementos = escenas.flatMap(e => (e.planos || []).map((x, i) => ({ escena: e, indice: i, plano: x })));
      const cuenta = await tanda(elementos, {
        ...o,
        yaHecho: el => Boolean(el.plano.imagen) && !el.plano.imagenObsoleta,
        hacer: (el, op) => { op.aviso(`plano ${el.plano.id}…`); return imagenPlano(el.escena, el.indice, op); },
        alAvanzar: () => pintarEscenas(),
      });
      if (cuenta.fallidos) ultimoError = { donde: 'general', texto: resumenTanda(cuenta) + '.\n' + cuenta.errores.map(e => `Plano ${e.elemento.plano.id}: ${e.texto}`).join('\n') };
      return resumenTanda(cuenta) + '.';
    });
  }
}
