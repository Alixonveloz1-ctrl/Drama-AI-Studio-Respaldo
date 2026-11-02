// Utilidades de interfaz compartidas: avisos, hoja inferior y escapado.

export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let temporizadorAviso;
export function avisar(mensaje, tipo = '') {
  const caja = document.getElementById('toast');
  if (!caja) return;
  caja.textContent = mensaje;
  caja.className = 'toast show' + (tipo ? ' ' + tipo : '');
  clearTimeout(temporizadorAviso);
  // Los errores se quedan más tiempo: hay que poder leerlos en el teléfono.
  temporizadorAviso = setTimeout(() => { caja.className = 'toast'; }, tipo === 'error' ? 7000 : 3200);
}

// Hoja que sube desde abajo, como en el estudio de anime. Una sola a la vez.
export function abrirHoja(html) {
  const contenedor = document.getElementById('modales');
  contenedor.innerHTML = `<div class="modal-overlay" data-cerrar-fondo><div class="modal" role="dialog" aria-modal="true"><div class="modal-handle"></div>${html}</div></div>`;
  const fondo = contenedor.firstElementChild;
  fondo.addEventListener('click', evento => { if (evento.target === fondo) cerrarHoja(); });
  fondo.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrarHoja));
  return fondo.querySelector('.modal');
}

export function cerrarHoja() {
  const contenedor = document.getElementById('modales');
  if (contenedor) contenedor.innerHTML = '';
}

// Imagen a pantalla completa (tocar para cerrar). Para revisar desde el teléfono.
export function verImagen(url, texto = '') {
  const capa = document.createElement('div');
  capa.className = 'visor';
  capa.innerHTML = `<button type="button" class="visor-cerrar" aria-label="Cerrar">✕</button><img alt="">${texto ? `<p>${escapar(texto)}</p>` : ''}`;
  capa.querySelector('img').src = url;
  capa.addEventListener('click', () => capa.remove());
  document.body.append(capa);
}
