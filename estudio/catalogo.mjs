// ════════════════════════════════════════════════════════════════
// CATÁLOGO CREATIVO — íntegro, como pidió el dueño (sección 5).
//
// Los 17 géneros, los 23 subgéneros y las 6 demografías del estudio de anime
// se conservan tal cual (mismos valores y etiquetas), y se añaden los 4
// géneros propios del formato drama. No falta ninguno; una prueba lo vigila.
// El formulario de la Historia (fase 2) se construye a partir de aquí.
// ════════════════════════════════════════════════════════════════

export const DEMOGRAFIAS = [
  { valor: 'shonen', etiqueta: 'Shōnen — Chicos adolescentes (acción, amistad, superación)' },
  { valor: 'shojo', etiqueta: 'Shōjo — Chicas adolescentes (relaciones, emociones, romance)' },
  { valor: 'seinen', etiqueta: 'Seinen — Hombres adultos (tramas complejas, temas maduros)' },
  { valor: 'josei', etiqueta: 'Josei — Mujeres adultas (vida adulta realista, romance complejo)' },
  { valor: 'kodomomuke', etiqueta: 'Kodomomuke — Infantil (historias sencillas con moraleja)' },
  { valor: 'donghua', etiqueta: 'Donghua — Animación china (cultivación, wuxia, xianxia)' },
];

export const GENEROS = [
  // Heredados del estudio de anime, tal cual.
  { valor: 'accion', etiqueta: 'Acción — Conflicto físico, peleas, adrenalina' },
  { valor: 'fantasia', etiqueta: 'Fantasía — Magia, criaturas sobrenaturales, sistemas de poder' },
  { valor: 'isekai', etiqueta: 'Isekai — Protagonista transportado/reencarnado a otro mundo' },
  { valor: 'mecha', etiqueta: 'Mecha — Robots gigantes pilotados' },
  { valor: 'romcom', etiqueta: 'Comedia Romántica — Amor con situaciones cómicas' },
  { valor: 'drama', etiqueta: 'Drama — Desarrollo emocional, conflictos tristes' },
  { valor: 'slice_of_life', etiqueta: 'Slice of Life — Vida cotidiana sin grandes conflictos' },
  { valor: 'terror', etiqueta: 'Terror / Horror — Miedo, inquietud, suspenso' },
  { valor: 'psicologico', etiqueta: 'Psicológico — Estado mental, traumas, crisis internas' },
  { valor: 'misterio', etiqueta: 'Misterio — Enigmas, crímenes, secretos ocultos' },
  { valor: 'deportes', etiqueta: 'Deportes (Spokon) — Disciplina, esfuerzo, equipo' },
  { valor: 'sci_fi', etiqueta: 'Ciencia Ficción — Tecnología futura, espacio, IA' },
  { valor: 'aventura', etiqueta: 'Aventura — Exploración, viajes, descubrimientos' },
  { valor: 'sobrenatural', etiqueta: 'Sobrenatural — Poderes ocultos, demonios, espíritus' },
  { valor: 'supervivencia', etiqueta: 'Supervivencia — Lucha por sobrevivir en entornos hostiles' },
  { valor: 'videojuego', etiqueta: 'Videojuego / Sistema — Estadísticas, niveles, habilidades' },
  { valor: 'donghua', etiqueta: 'Donghua / Cultivación — Sistema de qi, sectas, rangos de cultivo' },
  // Nuevos, propios del formato drama.
  { valor: 'transmigracion', etiqueta: 'Transmigración — Despierta en otra época o en otro cuerpo' },
  { valor: 'naufragio', etiqueta: 'Naufragio — Aislamiento, isla desierta, rescate imposible' },
  { valor: 'ascenso_social', etiqueta: 'Ascenso social — De despreciado a respetado' },
  { valor: 'sistema_juego', etiqueta: 'Sistema de niveles — Pantallas, puntos, desbloqueos' },
];

export const SUBGENEROS = [
  { valor: 'psicologico', etiqueta: '🧠 Psicológico' },
  { valor: 'romance', etiqueta: '💕 Romance' },
  { valor: 'ecchi', etiqueta: '🔥 Ecchi' },
  { valor: 'harem', etiqueta: '👑 Harem' },
  { valor: 'harem_inverso', etiqueta: '👸 Harem Inverso' },
  { valor: 'comedia', etiqueta: '😂 Comedia' },
  { valor: 'dark', etiqueta: '🖤 Dark / Oscuro' },
  { valor: 'gore', etiqueta: '💀 Gore / Violento' },
  { valor: 'misterio', etiqueta: '🔍 Misterio' },
  { valor: 'revenge', etiqueta: '⚔️ Revenge' },
  { valor: 'overpowered', etiqueta: '💪 Overpowered' },
  { valor: 'slice_of_life', etiqueta: '☕ Slice of Life' },
  { valor: 'musica', etiqueta: '🎵 Música / Arte' },
  { valor: 'deporte', etiqueta: '⚽ Deporte' },
  { valor: 'mafia', etiqueta: '🎭 Mafia / Crimen' },
  { valor: 'escolar', etiqueta: '🏫 Escolar' },
  { valor: 'militar', etiqueta: '🎖️ Militar' },
  { valor: 'reencarnacion', etiqueta: '♻️ Reencarnación' },
  { valor: 'viaje_tiempo', etiqueta: '⏳ Viaje en el Tiempo' },
  { valor: 'apocalipsis', etiqueta: '☣️ Apocalipsis' },
  { valor: 'idols', etiqueta: '🌟 Idols / Fama' },
  { valor: 'medicina', etiqueta: '🏥 Medicina / Ciencia' },
  { valor: 'sistema_awakening', etiqueta: '⚡ Sistema / Awakening' },
];

export const FORMATOS = [
  { valor: '9:16', etiqueta: '9:16 vertical — TikTok, Reels, Shorts y apps de microdrama' },
  { valor: '16:9', etiqueta: '16:9 horizontal — YouTube normal' },
];

// Reglas heredadas del estudio de anime que siguen vigentes.
export const SUBGENEROS_ADULTOS = ['ecchi', 'harem', 'harem_inverso', 'gore'];   // no con Kodomomuke
export const PARES_EXCLUYENTES = [['harem', 'harem_inverso']];
// Todos los personajes son adultos (18+); con «escolar», el entorno es
// universitario o academia de adultos, nunca secundaria (sección 5.2).
