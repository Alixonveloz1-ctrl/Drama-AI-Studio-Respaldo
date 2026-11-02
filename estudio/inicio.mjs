// ════════════════════════════════════════════════════════════════
// ARRANQUE DEL ESTUDIO — comprueba la sesión, monta la interfaz una vez y
// lee el diagnóstico. Abrir una pantalla solo lee recursos: nunca genera.
// ════════════════════════════════════════════════════════════════
import { protegerPagina, mostrarErrorSesion, cerrarSesion } from './acceso.mjs';
import { abrirApis, pedirSalud, resumen } from './salud.mjs';
import { abrirHoja, avisar } from './interfaz.mjs';

const $ = selector => document.querySelector(selector);

function ponerPunto(estado) {
  const punto = $('#apiDot');
  if (punto) punto.className = 'dot ' + estado;
}

function irA(panel) {
  document.querySelectorAll('.nav-tab').forEach(b => {
    const activo = b.dataset.panel === panel;
    b.classList.toggle('active', activo);
    b.setAttribute('aria-current', activo ? 'page' : 'false');
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + panel));
  try { localStorage.setItem('drama.panel', panel); } catch {}
  window.scrollTo({ top: 0 });
}

function abrirProyectos() {
  abrirHoja(`
    <h3>Proyectos</h3>
    <div class="empty"><svg class="icono"><use href="#i-carpeta"/></svg>
      <p>La lista de proyectos se reconstruye desde tu bucket, así que el mismo drama aparece en cualquier teléfono o computadora.</p>
      <p>Llega con la Historia, en la fase 2.</p>
    </div>
    <button class="btn" data-cerrar>Entendido</button>
  `);
}

let cableado = false;
function cablear() {
  if (cableado) return;
  cableado = true;
  document.querySelectorAll('.nav-tab').forEach(b => b.addEventListener('click', () => irA(b.dataset.panel)));
  $('#btnApis').addEventListener('click', () => {
    abrirApis().then(s => ponerPunto(resumen(s))).catch(e => { ponerPunto('mal'); if (e.status === 401) mostrarErrorSesion(e); });
  });
  $('#btnProyectos').addEventListener('click', abrirProyectos);
  $('#btnComprobar').addEventListener('click', () => $('#btnApis').click());
}

async function montar(usuario) {
  cablear();
  let panel = 'historia';
  try { panel = localStorage.getItem('drama.panel') || panel; } catch {}
  if (!document.getElementById('panel-' + panel)) panel = 'historia';
  irA(panel);
  $('#correo-sesion').textContent = usuario.email || '';
  // La pantalla de "comprobando" se quita cuando la interfaz ya está
  // dibujada de verdad, no antes.
  $('#comprobando').hidden = true;
  $('#app').hidden = false;
  // Diagnóstico de solo lectura para el punto de color del botón APIS.
  pedirSalud()
    .then(s => {
      ponerPunto(resumen(s));
      if (s.version?.commit) $('#version').textContent = 'v' + s.version.commit;
      if (resumen(s) === 'mal') avisar('Hay algo pendiente en la configuración. Pulsa APIS para ver qué.', 'error');
    })
    .catch(e => { ponerPunto('mal'); avisar(e.message, 'error'); });
}

function fallo(error) {
  const texto = $('#comprobando-texto');
  if (texto && !$('#comprobando').hidden) {
    texto.textContent = error?.message || String(error);
    // Con una cuenta que no es la autorizada, el dueño necesita poder salir
    // y entrar con la buena sin quedarse atascado en esta pantalla.
    const reentrar = $('#btnReentrar');
    if (error?.status === 401 || error?.status === 403) {
      reentrar.hidden = false;
      reentrar.onclick = () => cerrarSesion();
    }
  } else {
    mostrarErrorSesion(error);
  }
}

protegerPagina(montar, fallo).catch(fallo);
