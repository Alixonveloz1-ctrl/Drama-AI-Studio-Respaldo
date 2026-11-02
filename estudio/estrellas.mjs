// Fondo de estrellas y cometas, igual que en el estudio de anime.
// Sin dependencias: no lee proyectos ni genera nada.
const campo = document.querySelector('#starfield');
if (campo) {
  for (let i = 0; i < 60; i++) {
    const estrella = document.createElement('div');
    estrella.className = 'star';
    const tam = Math.random() * 2 + 0.5;
    estrella.style.cssText = `width:${tam}px;height:${tam}px;left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 4}s`;
    campo.append(estrella);
  }
  // Se respeta la preferencia del dispositivo de reducir movimiento, y no se
  // dibujan cometas con la pestaña en segundo plano.
  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  setInterval(() => {
    if (document.hidden || reducido.matches) return;
    const cometa = document.createElement('div');
    cometa.className = 'comet';
    cometa.style.animation = 'shoot 3s linear';
    campo.append(cometa);
    setTimeout(() => cometa.remove(), 3000);
  }, 8000);
}
