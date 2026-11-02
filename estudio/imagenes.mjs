// ════════════════════════════════════════════════════════════════
// PROMPTS DE IMAGEN — en inglés (los modelos de imagen obedecen mejor).
// El contrato de estilo semirrealista NO va aquí: lo añade siempre el
// servidor, primero, y no se puede sustituir.
// ════════════════════════════════════════════════════════════════

// Ficha maestra: UNA sola imagen limpia por personaje (sección 10.1).
export function promptFichaPersonaje(p) {
  return `Single clean CHARACTER REFERENCE still of ${p.nombre}, a ${p.edad}-year-old adult, ${p.rol || 'character'}. ${p.appearance || p.aspecto}. ONE person only, full body from head to feet, neutral standing pose, three-quarter front view, face clearly readable, hands visible, plain light-grey studio backdrop with soft even light. Wardrobe exactly as described. Hair exactly as described. No turnaround, no collage, no multiple poses, no expression sheet.`;
}

// Referencia de escenario: el lugar vacío, para fijar su arquitectura y su luz.
export function promptEscenario(e) {
  return `ESTABLISHING SHOT of a drama location: ${e.nombre}. ${e.description || e.descripcion}. ${e.interior ? 'Interior space.' : 'Exterior space.'} No people in frame. A wide production-design reference still that clearly shows the layout, architecture, materials, props and motivated light of the place.`;
}

// Variante: se edita la imagen de la madre con la descripción del cambio.
export function promptVariante(v) {
  return `Show this same person ${v.cambio}`;
}
