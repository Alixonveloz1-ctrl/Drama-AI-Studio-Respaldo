// ════════════════════════════════════════════════════════════════
// PROMPTS DE TEXTO — en español (los de imagen y video irán en inglés).
//
// Salen de la especificación (secciones 5 a 8) y de las reglas que el
// estudio de anime ya corrigió con fallos reales. Aquí solo hay textos y su
// montaje; la validación de lo que vuelve está en guion.mjs.
// ════════════════════════════════════════════════════════════════
import { GENEROS, SUBGENEROS, PUBLICOS, SUBGENEROS_ADULTOS } from './catalogo.mjs';

export const PALABRAS_POR_MINUTO = 145;   // el ritmo de voz que usa el estudio de anime
export const segundosDe = palabras => palabras / (PALABRAS_POR_MINUTO / 60);

// La etiqueta del catálogo sin el emoji del principio («🧠 Psicológico» → «Psicológico»).
const etiqueta = (lista, valor) => String(lista.find(x => x.valor === valor)?.etiqueta || valor).replace(/^[^\p{L}]+/u, '');

// ─── Géneros, pensados para drama asiático semirrealista ───
export const GUIAS_GENERO = {
  accion: 'GÉNERO: Acción. El motor es el conflicto físico: peleas, persecuciones y enfrentamientos con riesgo real. Las escenas muestran acción física, no solo conversación.',
  fantasia: 'GÉNERO: Fantasía. Hay magia, criaturas o un sistema de poder con reglas internas claras. Es un mundo propio, no el mundo moderno.',
  isekai: 'GÉNERO: Isekai. El protagonista despierta en otro mundo o en otro cuerpo con la mentalidad de su vida anterior. Su ventaja es el conocimiento de esa vida (oficios, ciencia básica, criterio moderno), usado con ingenio y con consecuencias reales. Hereda la familia, las deudas, los enemigos y la reputación del cuerpo. No hay Sistema salvo que el proyecto lo tenga activo.',
  mecha: 'GÉNERO: Mecha. El protagonista pilota una máquina de combate gigante; la máquina es central en la trama, con política militar y tecnología avanzada.',
  romcom: 'GÉNERO: Comedia romántica. Una relación amorosa con malentendidos y situaciones cómicas; tono ligero y tensión romántica creciente.',
  drama: 'GÉNERO: Drama. Desarrollo emocional y conflictos dolorosos; los personajes sufren y crecen. No es comedia.',
  slice_of_life: 'GÉNERO: Vida cotidiana. Lo pequeño del día a día: trabajo, comidas, conversaciones. Sin villanos mundiales, sin magia, sin catástrofes.',
  terror: 'GÉNERO: Terror. El objetivo es causar miedo e inquietud: amenaza creciente, atmósfera opresiva y momentos de impacto.',
  psicologico: 'GÉNERO: Psicológico. El estado mental de los personajes (traumas, obsesiones, crisis) pesa más que la trama externa.',
  misterio: 'GÉNERO: Misterio. El motor es resolver un enigma (crimen, secreto, desaparición) con pistas, sospechosos y revelaciones graduales; el protagonista investiga.',
  deportes: 'GÉNERO: Deportes. Una disciplina concreta, entrenamiento, esfuerzo y rivalidades; los partidos son los clímax.',
  sci_fi: 'GÉNERO: Ciencia ficción. Tecnología futura, espacio o IA con reglas científicas, no mágicas.',
  aventura: 'GÉNERO: Aventura. Un viaje hacia un objetivo lejano: exploración, peligros en el camino y descubrimientos.',
  sobrenatural: 'GÉNERO: Sobrenatural. Espíritus, maldiciones o poderes ocultos bajo el mundo cotidiano, con reglas misteriosas que el protagonista descifra.',
  supervivencia: 'GÉNERO: Supervivencia. Entorno hostil, recursos escasos y decisiones desesperadas; la muerte es una amenaza real y la tensión no baja.',
  videojuego: 'GÉNERO: Videojuego / Sistema. El protagonista tiene un Sistema con notificaciones concretas («Misión cumplida. Recompensa: 50 puntos»), reglas claras, límites y misiones; el poder se gana con esfuerzo concreto. El Sistema siempre está presente.',
  donghua: 'GÉNERO: Donghua / Cultivación. Mundo de cultivación (qi, rangos de poder, sectas) en China antigua o fantástica: entrenamiento, avances de rango, torneos, humillación y revancha.',
  transmigracion: 'GÉNERO: Transmigración. Un hombre o una mujer de hoy muere o pierde el conocimiento y despierta en otra época o en otro cuerpo (a menudo la China antigua). Usa lo que sabe de su mundo (comercio, ciencia básica, medicina, oficios) para resolver problemas que la época no sabe resolver. Hereda la vida del cuerpo: familia, deudas, enemigos y reputación. Cada solución choca con las reglas de la época y provoca asombro.',
  naufragio: 'GÉNERO: Naufragio. Un grupo queda aislado en una isla o lugar sin rescate posible. Escasez de agua, comida y refugio; clima, animales y otros náufragos como amenaza. Las jerarquías del grupo cambian según quién resuelve los problemas.',
  ascenso_social: 'GÉNERO: Ascenso social. El protagonista empieza despreciado (por su familia, su prometida, su empresa o su clan) con una humillación concreta y pública. Cada ciclo invierte el estatus delante de testigos; quienes lo despreciaron reaccionan con incredulidad y sumisión.',
  sistema_juego: 'GÉNERO: Sistema de niveles. El protagonista tiene un Sistema con pantallas, puntos, misiones y desbloqueos. El Sistema le habla en voz en off, fija reglas y plazos, y entrega recompensas que se ven subir. Cada misión es un ciclo de retención.',
};

export const GUIAS_SUBGENERO = {
  psicologico: 'Psicológico: mente, traumas y percepción alterada.',
  romance: 'Romance: tensión romántica real entre personajes.',
  ecchi: 'Ecchi: fan service para adultos: mujeres muy atractivas, ropa sugerente y situaciones comprometedoras que nacen de la trama (ver REGLAS ECCHI); nada explícito.',
  harem: 'Harem: protagonista masculino con tres o más mujeres atractivas interesadas en él, que compiten por su atención; siempre con fan service adulto.',
  harem_inverso: 'Harem inverso: protagonista femenina con tres o más hombres atractivos interesados en ella, que compiten por su atención; siempre con fan service adulto.',
  comedia: 'Comedia: humor nacido de la situación y de los personajes, con malentendidos reales.',
  dark: 'Oscuro: temas duros sin suavizar y consecuencias reales.',
  gore: 'Violento: violencia explícita y heridas con peso.',
  misterio: 'Misterio: secretos entre personas y pistas concretas.',
  revenge: 'Venganza: motivada por agravios concretos entre personajes.',
  overpowered: 'Overpowered: el protagonista es muy superior dentro de las reglas del mundo.',
  slice_of_life: 'Vida cotidiana: detalles mundanos y ritmo cercano.',
  musica: 'Música / Arte: práctica, actuaciones y presentaciones.',
  deporte: 'Deporte: entrenamiento, competiciones y marcadores.',
  mafia: 'Mafia / Crimen: jerarquías criminales, delitos y consecuencias.',
  escolar: 'Escolar: SIEMPRE universidad o academia de adultos, nunca secundaria.',
  militar: 'Militar: disciplina, rango, misiones y guerra.',
  reencarnacion: 'Reencarnación: vuelve a nacer o a empezar con la memoria de otra vida.',
  viaje_tiempo: 'Viaje en el tiempo: saltos temporales con reglas y consecuencias.',
  apocalipsis: 'Apocalipsis: el mundo conocido se derrumba; supervivencia y recursos.',
  idols: 'Idols / Fama: industria del espectáculo, imagen pública y rivalidades.',
  medicina: 'Medicina / Ciencia: diagnósticos, curas y conocimiento técnico como arma.',
  sistema_awakening: 'Sistema / Awakening: un Sistema con estadísticas, niveles, misiones y notificaciones.',
};

export const GUIAS_PUBLICO = {
  masculino: 'PÚBLICO MASCULINO: revancha, ascenso de estatus, poder, ingenio y combates. La recompensa es estatus, poder, dinero o aliados, y la reacción de los demás es asombro, incredulidad o sumisión.',
  femenino: 'PÚBLICO FEMENINO: romance, relación con una figura poderosa, renacer para cambiar el destino, venganza sentimental e intriga de palacio o de familia. La recompensa es amor, dignidad, poder social o justicia.',
  adulto: 'PÚBLICO ADULTO: tramas complejas, dilemas morales, personajes grises y temas duros sin suavizar.',
  familia: 'PARA TODA LA FAMILIA: sin contenido sexual ni sugerente, sin violencia explícita y sin lenguaje fuerte. El conflicto y la recompensa siguen siendo claros y emocionantes.',
};

// ─── Reglas fijas ───
export const REGLA_ADULTOS = 'REGLA OBLIGATORIA: TODOS los personajes son adultos (18 años o más). Si el subgénero «Escolar» está activo, el entorno es una universidad o academia de adultos, nunca secundaria. Esta regla anula cualquier otra lectura y es obligatoria con contenido sugerente o harem.';

// Ecchi, harem y harem inverso llevan siempre fan service adulto (regla del
// estudio de anime). Con «Para toda la familia» quedan desactivados.
export function esEcchi(formulario) {
  return subgenerosEfectivos(formulario).some(s => ['ecchi', 'harem', 'harem_inverso'].includes(s));
}

// Del estudio de anime: un subgénero es una CAPA sobre el género, nunca lo sustituye.
export const REGLA_DE_CAPAS = 'REGLA DE CAPAS: cada subgénero seleccionado se tiene que NOTAR de verdad en la historia, y todos a la vez; ninguno es decorativo. Los subgéneros modifican el género principal, nunca lo sustituyen: si uno parece pedir lo contrario, gana el género principal y el subgénero se aplica dentro de sus reglas.';

// Decisión del dueño: las mujeres salen hermosas y los hombres atractivos,
// como en los dramas asiáticos de gran producción.
export const REPARTO_ATRACTIVO = 'REPARTO CON EL ATRACTIVO DE UN DRAMA ASIÁTICO DE GRAN PRODUCCIÓN: las mujeres adultas son muy hermosas, con el aspecto de las actrices de los dramas coreanos y chinos de éxito (rasgos finos de idol, rostro en V, ojos grandes y luminosos, piel de porcelana impecable, pelo brillante, figura esbelta y atractiva, bien arregladas según su época y su oficio) y los hombres principales son atractivos como los galanes de esos dramas. En historias de hoy pueden llevar el pelo teñido (castaño, caoba, rubio) si encaja con el personaje. La belleza se mantiene aunque el personaje sea pobre o esté en apuros: el vestuario cuenta su situación, no la cara.';

export const DISENO_ECCHI = `MODIFICADOR ECCHI ACTIVO — DISEÑO ADULTO DE LOS PERSONAJES:
- Todos son adultos (18+) y se ven claramente adultos. Nunca secundaria ni uniformes asociados a menores.
- Las mujeres tienen una figura muy atractiva y voluptuosa, cada una con su propio tipo y rasgos reconocibles (no clones de la misma figura).
- Su vestuario habitual realza la figura dentro de su época, su oficio y su estatus: ajustado, con escote o aberturas, telas que marcan la figura pero SIEMPRE opacas (nada transparente ni que deje ver el pecho a través). Escríbelo en "aspecto" y en "appearance".
- En "appearance" (inglés) usa palabras que el generador de imagen acepta: "stunningly beautiful", "curvy figure", "form-fitting", "low neckline", "high slit". Nunca desnudez ni partes íntimas.`;

export const REGLAS_ECCHI_GUION = `REGLAS ECCHI (contenido para adultos; se COMBINA con el género principal, no lo reemplaza):
- Teje momentos reales de fan service donde la escena lo permita, con variedad entre ellos: caída accidental encima de alguien, ropa mojada tras la lluvia o el agua (se pega al cuerpo pero nunca se transparenta), cambio de ropa interrumpido, toalla que casi cae, ropa ajustada de trabajo o de deporte, inclinarse sin darse cuenta, proximidad incómoda en un sitio estrecho, baño termal, ropa de dormir.
- El momento se VE: escríbelo en "accion" (lo que se ve al empezar la escena) con un hecho físico concreto. El diálogo no lo describe ni lo señala: reacciona a él (vergüenza, provocación, celos).
- Prohibido el inventario de anatomía y los adjetivos metidos a empujones: suena forzado y hace que el generador rechace el plano.
- Sin desnudez explícita ni partes íntimas.`;

export const CONTRATO_FIDELIDAD = 'CONTRATO DE FIDELIDAD: el género principal y los subgéneros seleccionados son la ÚNICA fuente de tropos y mecánicas. Lo característico de subgéneros NO seleccionados no existe en esta historia. Nadie puede cambiar el género: el trabajo es que ESE género se sienta excelente, no reinterpretarlo ni suavizarlo.';

export const ANATOMIA_FORMATO = `ANATOMÍA DEL FORMATO (drama corto que se mira en el teléfono; es lo que hay que igualar):
1. APERTURA DENTRO DEL CONFLICTO: sin presentación ni contexto. En los primeros 15 segundos hay un conflicto visible (una discusión, una bofetada, una muerte, una amenaza). En los primeros 30 segundos aparece el elemento que hace especial a esta historia (el Sistema, la ventaja, el recurso imposible).
2. EL CICLO DE RETENCIÓN, que se repite todo el episodio:
   a) Aparece un problema: escasez, amenaza, humillación o enemigo.
   b) El protagonista lo resuelve con una habilidad, un conocimiento de su mundo de origen o algo que le entrega el Sistema.
   c) Los demás reaccionan con asombro, incredulidad o sumisión. Esta reacción es OBLIGATORIA: es la mitad del gancho.
   d) Gana algo visible: dinero, respeto, un aliado, puntos, una tecnología.
   Cadencia: un ciclo cada 45 a 90 segundos.
3. El pensamiento interno del protagonista va ANTES de ejecutar la jugada, no después: el espectador sabe lo que va a pasar y se queda a ver la cara de los demás.
4. VOCES: el diálogo entre personajes es la gran mayoría (esto se actúa, no se narra). El pensamiento interno del protagonista es una parte pequeña. NO EXISTE narrador que cuente la historia; la única voz en off permitida es la del Sistema, y solo si la historia tiene Sistema.`;

export const REGLAS_ESCRITURA = `REGLAS DE ESCRITURA (cada una corrige un fallo real):
- Prohibido el resumen escolar: nada de «durante los días siguientes entrenó y mejoró mucho». Si un crecimiento importa, se muestran dos o tres hechos concretos que lo prueben.
- Cada solución produce una consecuencia o una necesidad nueva. Un problema resuelto que no cambia nada es un ciclo desperdiciado.
- Las revelaciones reciben reacción antes de cambiar de asunto.
- Español oral: frases cortas, diálogo directo, punto de vista cercano, microcambios frecuentes. La frase típica tiene de 5 a 10 palabras.
- Prohibida la prosa literaria y el texto que suena a IA («el aire estaba cargado», «sus ojos reflejaban», «silencio ensordecedor», «una mezcla de emociones», «como si el tiempo se hubiera detenido»…).
- Nada de diálogo resumido en estilo indirecto («le dijo que…», «explicó que…»): se oye la conversación.`;

// ─── Sistema: solo cuando la historia es de sistema (sección 8) ───
export function sistemaObligatorio(formulario) {
  return ['videojuego', 'sistema_juego'].includes(formulario?.genero) || (formulario?.subgeneros || []).includes('sistema_awakening');
}
export function sistemaPermitido(formulario) {
  return sistemaObligatorio(formulario) || /\bsistema\b/i.test(formulario?.concepto || '');
}

export function subgenerosEfectivos(formulario) {
  const lista = Array.isArray(formulario?.subgeneros) ? formulario.subgeneros : [];
  return formulario?.publico === 'familia' ? lista.filter(s => !SUBGENEROS_ADULTOS.includes(s)) : lista;
}

// Bloque común con la elección del dueño.
export function contextoEleccion(formulario) {
  const subs = subgenerosEfectivos(formulario);
  const obligatorio = sistemaObligatorio(formulario), permitido = sistemaPermitido(formulario);
  return `ELECCIÓN DEL DUEÑO (canon cerrado):
- Público: ${etiqueta(PUBLICOS, formulario.publico)}
- Género principal: ${etiqueta(GENEROS, formulario.genero)}
- Subgéneros: ${subs.length ? subs.map(s => etiqueta(SUBGENEROS, s)).join(', ') : 'ninguno'}
- Formato de pantalla: ${formulario.formato === '16:9' ? '16:9 horizontal (YouTube)' : '9:16 vertical (TikTok, Reels, microdrama)'}
- Duración del episodio: ${formulario.duracion === 3 ? 'prueba de 3 minutos' : 'unos 30 minutos'}
- Cierre: ${formulario.cierre === 'suspenso' ? 'en suspenso (gancho explícito para el siguiente episodio)' : 'completo (la historia termina)'}

${GUIAS_PUBLICO[formulario.publico] || ''}
${GUIAS_GENERO[formulario.genero] || ''}
${subs.map(s => '- ' + (GUIAS_SUBGENERO[s] || s)).join('\n')}

${CONTRATO_FIDELIDAD}
${subs.length ? REGLA_DE_CAPAS + '\n' : ''}${esEcchi(formulario) ? 'CONTENIDO ECCHI PARA ADULTOS ACTIVO: hay fan service visible en la historia, con mujeres muy atractivas y situaciones sugerentes que nacen de la trama; nada explícito.\n' : ''}${REGLA_ADULTOS}
SISTEMA: ${obligatorio ? 'esta historia TIENE Sistema (pantallas, notificaciones, misiones y recompensas; su voz en off es la única permitida).'
    : permitido ? 'el concepto del dueño menciona un sistema: decide si la historia lo tiene según ese concepto.'
    : 'esta historia NO tiene Sistema: no existen pantallas, niveles, puntos, misiones ni notificaciones.'}
ESTILO VISUAL YA FIJADO: el de las portadas y miniaturas de los dramas cortos asiáticos de éxito: semirrealista, pulido y luminoso, con personajes de belleza de estrella de drama coreano o chino. Las descripciones de personas y lugares son concretas y filmables.`;
}

function conceptoCanon(formulario) {
  const c = String(formulario.concepto || '').trim();
  return c ? `\nCONCEPTO DEL DUEÑO — TEXTO LITERAL Y CANON OBLIGATORIO:\n«${c}»\nConserva cada nombre propio, cada relación y la premisa tal como están escritos. Tu trabajo es expandirlo, no cambiarlo.\n` : '';
}

// ─── 1. Tres ideas (solo título y concepto breve: regla U011) ───
export function promptIdeas(formulario, anteriores = []) {
  return {
    sistema: 'Eres creador de dramas cortos asiáticos para teléfono (transmigración, supervivencia, ascenso, sistemas). Tu prioridad es la retención: una premisa con conflicto inmediato y recompensas que se repiten. No buscas ser original por serlo. Respondes SOLO JSON válido.',
    mensaje: `${contextoEleccion(formulario)}
${conceptoCanon(formulario)}
${ANATOMIA_FORMATO}
${anteriores.length ? `\nYa se propusieron estas; las nuevas deben ser distintas:\n${anteriores.map(i => '- ' + i.titulo).join('\n')}\n` : ''}
Propón TRES ideas distintas entre sí${formulario.concepto ? ' (tres maneras de desarrollar el concepto del dueño, conservando sus nombres y su premisa)' : ''}.
Cada idea lleva SOLO un título y un concepto breve de 2 o 3 frases que deje claro el conflicto inicial y la ventaja del protagonista. NO desarrolles nada más: ni personajes, ni episodios, ni mundo.

Devuelve JSON: {"ideas":[{"titulo":"…","concepto":"…"},{"titulo":"…","concepto":"…"},{"titulo":"…","concepto":"…"}]}`,
    temperatura: 0.95,
  };
}

// ─── 2. Universo ───
export function promptUniverso(formulario, idea) {
  return {
    sistema: `Eres creador de universos para dramas cortos asiáticos semirrealistas. Diseñas premisa, mundo, reglas, personajes y escenarios sobre la idea elegida; NO escribes todavía el guion. ${CONTRATO_FIDELIDAD} Respondes SOLO JSON válido.`,
    mensaje: `${contextoEleccion(formulario)}
${conceptoCanon(formulario)}
IDEA ELEGIDA POR EL DUEÑO (canon):
Título: ${idea.titulo}
Concepto: ${idea.concepto}

${ANATOMIA_FORMATO}

Desarrolla el universo de esa idea. Personajes: entre 3 y 7 recurrentes, todos adultos, con aspecto concreto y filmable (rostro, pelo exacto con su largo y peinado, complexión, ropa habitual); escribe el aspecto en español y también en inglés para el equipo de imagen.
${REPARTO_ATRACTIVO}
${esEcchi(formulario) ? DISENO_ECCHI + '\n' : ''}El vestuario y el aspecto también reflejan el género y CADA subgénero elegido (un médico parece médico, una idol parece idol, un mafioso parece mafioso). Escenarios: entre 3 y 6 lugares donde ocurrirá la historia; la PRIMERA frase de cada descripción dice si es interior o exterior.

Devuelve JSON:
{
  "titulo": "título del drama",
  "gancho": "frase gancho de 12 palabras como máximo",
  "premisa": "3 o 4 frases",
  "mundo": "lugar, época y sociedad en 2 o 3 frases",
  "reglas": ["regla concreta del mundo", "…"],
  "ventaja": "lo que hace especial al protagonista (el Sistema, la ventaja, el recurso imposible); aparecerá en los primeros 30 segundos",
  "tieneSistema": true o false,
  "sistema": {"nombre": "nombre del Sistema", "reglaDelJuego": "la regla que anuncia en su primer panel", "cuentaAtras": "plazo si lo hay, o vacío"} o null,
  "personajes": [{"id": "c1", "nombre": "…", "sexo": "mujer | hombre", "edad": 25, "rol": "protagonista | antagonista | aliado | interés amoroso | secundario", "aspecto": "en español", "appearance": "the same in English", "personalidad": "…", "formaDeHablar": "…"}],
  "escenarios": [{"id": "l1", "nombre": "…", "interior": true, "descripcion": "Interior. …", "description": "the same in English"}]
}
El primer personaje es el protagonista.`,
    temperatura: 0.8,
  };
}

// ─── Contexto del universo para los siguientes pasos ───
export function contextoUniverso(datos) {
  const u = datos.universo;
  const personajes = u.personajes.map(p => `- ${p.id} = ${p.nombre} (${p.rol}, ${p.edad} años): ${p.personalidad || ''}${p.formaDeHablar ? ' Habla: ' + p.formaDeHablar : ''}`).join('\n');
  const escenarios = u.escenarios.map(e => `- ${e.id} = ${e.nombre}: ${e.descripcion}`).join('\n');
  return `DRAMA: ${u.titulo}
Gancho: ${u.gancho}
Premisa: ${u.premisa}
Mundo: ${u.mundo}
Reglas del mundo: ${(u.reglas || []).join(' · ')}
Ventaja del protagonista: ${u.ventaja}
${u.tieneSistema && u.sistema ? `SISTEMA: ${u.sistema.nombre}. Regla del juego: ${u.sistema.reglaDelJuego}${u.sistema.cuentaAtras ? '. Plazo: ' + u.sistema.cuentaAtras : ''}.` : 'Esta historia NO tiene Sistema.'}

PERSONAJES (usa estos ids):
${personajes}

ESCENARIOS (usa estos ids):
${escenarios}`;
}

// ─── 3. Biblia de la serie (director creativo) ───
export function sistemaDirector(formulario) {
  return `Eres DIRECTOR CREATIVO de dramas cortos asiáticos para teléfono, con veinte años de oficio. Tu prioridad es la retención y ejecutas el formato sin diluirlo.
LÍMITES DE TU AUTORIDAD: decides la identidad visual, sonora y de ritmo, y qué debe lograr cada episodio. NO decides el género: «${etiqueta(GENEROS, formulario.genero)}» y sus subgéneros son un encargo cerrado. No inventas mecánicas que el género no tiene.
CÓMO TRABAJAS: concreto sobre abstracto («farol de papel naranja como única luz cálida de noche», no «iluminación atmosférica»); cada decisión se puede filmar, componer o cronometrar; coherencia por encima de novedad.
EL ESTILO DE IMAGEN YA ESTÁ FIJADO: el de las portadas de los dramas cortos asiáticos de éxito: semirrealista, pulido, luminoso y con colores vivos, con personajes de belleza de idol. Tú eliges paleta, luz, composición y motivos; nunca pidas anime, dibujo ni ilustración.
Respondes SOLO JSON válido.`;
}

export function promptBiblia(datos) {
  const f = datos.formulario;
  return {
    sistema: sistemaDirector(f),
    mensaje: `${contextoEleccion(f)}

${contextoUniverso(datos)}

${ANATOMIA_FORMATO}

Escribe la BIBLIA DE LA SERIE. Se inyectará en todos los pasos posteriores.
Devuelve JSON:
{
  "direccionVisual": "paleta concreta (3-4 colores) y luz con fuentes motivadas para ESTA serie, en 3-4 frases filmables",
  "identidadMusical": "familia instrumental, textura y tempo de la banda sonora; oscila entre tensión, aventura y fanfarria de triunfo, sin tapar el diálogo",
  "ritmoNarrativo": "cómo respira el episodio: dónde acelera, dónde deja reaccionar, cada cuánto llega el ciclo",
  "ritmoMontaje": "cadencia de cortes: planos de acción de 4 s y de cobertura de 1,5 a 3 s; cuándo esta serie usa el extremo rápido",
  "motivosRecurrentes": ["objeto, gesto o encuadre que reaparece con sentido", "…", "…"],
  "reglasDeOro": ["regla causal que esta historia nunca rompe", "regla de personaje", "regla de tono", "regla de continuidad"],
  "arcoTemporada": ["etapa 1", "etapa 2", "etapa 3", "etapa 4", "etapa 5"]
}`,
    temperatura: 0.7,
  };
}

// La dirección visual NO se manda a quien escribe el guion: en el estudio de
// anime eso hizo que el episodio abriera describiendo la paleta («el calor del
// mediodía tiñendo de ocre el polvo») en vez de entrar en el conflicto.
export function bibliaParaGuion(biblia) {
  if (!biblia) return '';
  const lista = v => (Array.isArray(v) ? v : []);
  return `BIBLIA DE LA SERIE (obligatoria):
RITMO: ${biblia.ritmoNarrativo || ''}
${lista(biblia.motivosRecurrentes).length ? `MOTIVOS RECURRENTES (que aparezcan con naturalidad): ${lista(biblia.motivosRecurrentes).join(' · ')}` : ''}
${lista(biblia.reglasDeOro).length ? `REGLAS DE ORO:\n${lista(biblia.reglasDeOro).map(r => '- ' + r).join('\n')}` : ''}
${lista(biblia.arcoTemporada).length ? `ARCO DE LA TEMPORADA:\n${lista(biblia.arcoTemporada).map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}`;
}

// ─── 4. Nota del episodio ───
export function promptNota(datos, numero) {
  const f = datos.formulario;
  return {
    sistema: sistemaDirector(f),
    mensaje: `${contextoEleccion(f)}

${contextoUniverso(datos)}

${bibliaParaGuion(datos.biblia)}

Vas a dirigir el EPISODIO ${numero} (${f.duracion === 3 ? 'prueba de 3 minutos' : 'unos 30 minutos'}). Cierre: ${f.cierre === 'suspenso' ? 'EN SUSPENSO: resuelve algo importante y deja un gancho explícito para el siguiente.' : 'COMPLETO: el conflicto central se cierra.'}
Devuelve JSON:
{
  "objetivo": "qué transformación concreta completa este episodio (1-2 frases)",
  "curvaEmocional": "de qué estado parte el espectador y a cuál llega",
  "imagenClave": "una imagen memorable que nace de un hecho de la trama",
  "notaDeDireccion": "qué potenciar o evitar para mantener la retención",
  "quedaAbierto": "${f.cierre === 'suspenso' ? 'el problema concreto que queda abierto' : 'solo una posibilidad secundaria opcional'}"
}`,
    temperatura: 0.7,
  };
}

// ─── 5. Bloques del guion ───
// Un episodio de 30 minutos no cabe en una llamada de 60 s: se escribe por
// bloques y se guarda cada bloque terminado.
export function planDelEpisodio(formulario) {
  const minutos = formulario.duracion === 3 ? 3 : 30;
  const total = Math.round(minutos * PALABRAS_POR_MINUTO);
  const bloques = minutos === 3 ? 1 : 6;
  const porBloque = Math.round(total / bloques);
  return Array.from({ length: bloques }, (_, i) => ({ fase: faseDe(i, bloques), palabras: porBloque, ciclos: ciclosPara(porBloque) }));
}

export function ciclosPara(palabras) {
  return Math.max(1, Math.round(segundosDe(palabras) / 75));   // uno cada 45-90 s
}

function faseDe(i, total) {
  if (total === 1) return 'unico';
  if (i === 0) return 'apertura';
  if (i === total - 1) return 'final';
  const p = (i + 1) / total;
  return p <= 0.34 ? 'temprano' : p <= 0.55 ? 'medio' : p <= 0.8 ? 'escalada' : 'preclimax';
}

export function textoFase(fase, cierre) {
  const final = cierre === 'suspenso'
    ? 'CIERRE EN SUSPENSO: resuelve algo importante y termina con un gancho explícito para el episodio siguiente.'
    : 'CIERRE COMPLETO: paga el conflicto central y deja reaccionar a quienes subestimaron al protagonista.';
  return {
    unico: `BLOQUE ÚNICO DEL EPISODIO: abre DENTRO del conflicto (visible en los primeros 15 segundos), muestra el elemento especial antes de los 30 segundos, encadena los ciclos completos pedidos y termina con el ${final}`,
    apertura: 'BLOQUE DE APERTURA: abre DENTRO del conflicto (visible en los primeros 15 segundos) y muestra el elemento especial antes de los 30 segundos. Primera demostración, primera reacción y primera recompensa.',
    temprano: 'DESARROLLO TEMPRANO: nuevas demostraciones; cada victoria aumenta recursos, estatus, poder, relaciones o información.',
    medio: 'DESARROLLO MEDIO: repite la mecánica de recompensa sin repetir el mismo hecho; los problemas crecen.',
    escalada: 'ESCALADA: vuelve quien subestimó al protagonista o aparece alguien de más estatus que mide su crecimiento.',
    preclimax: 'PRECLÍMAX: prepara la inversión pública de estatus, la gran revelación o el choque con la amenaza superior.',
    final: `BLOQUE FINAL: ${final}`,
  }[fase] || '';
}

function canonCompacto(datos, numero) {
  const episodio = datos.episodios?.[numero];
  const nombres = Object.fromEntries((datos.universo?.personajes || []).map(p => [p.id, p.nombre]));
  const lineas = [];
  for (const bloque of episodio?.bloques || []) {
    for (const escena of bloque.escenas || []) {
      lineas.push(`[${escena.titulo}]`);
      for (const l of escena.lineas || []) {
        const quien = l.tipo === 'sistema' ? 'SISTEMA' : (nombres[l.personaje] || l.nombre || l.personaje || '');
        lineas.push(`${quien}${l.tipo === 'pensamiento' ? ' (piensa)' : ''}: ${l.texto}`);
      }
    }
  }
  return lineas.join('\n');
}

// Lo que cada bloque tiene que demostrar con una cita: el género y cada subgénero.
export function huellasPedidas(formulario) {
  const lista = [{ clave: 'genero', etiqueta: `el género «${etiqueta(GENEROS, formulario.genero).split(' — ')[0]}»` }];
  for (const s of subgenerosEfectivos(formulario)) {
    lista.push({ clave: s, etiqueta: s === 'ecchi' ? 'un momento de fan service (ecchi)' : `el subgénero «${etiqueta(SUBGENEROS, s)}»` });
  }
  return lista;
}

export function promptBloque(datos, numero, indice, plan, extra = '') {
  const f = datos.formulario;
  const u = datos.universo;
  const pieza = plan[indice];
  const canon = canonCompacto(datos, numero);
  const nota = datos.episodios?.[numero]?.nota;
  const protagonista = u.personajes[0];
  const esApertura = indice === 0;
  const tipos = u.tieneSistema ? '"dialogo" | "pensamiento" | "sistema"' : '"dialogo" | "pensamiento"';
  return {
    sistema: `Eres guionista de dramas cortos asiáticos para teléfono. Escribes escenas actuadas: diálogo directo entre personajes, pensamiento interno breve del protagonista y nada de narrador. ${CONTRATO_FIDELIDAD} ${REGLA_ADULTOS} Respondes SOLO JSON válido.`,
    mensaje: `${contextoEleccion(f)}

${contextoUniverso(datos)}

${bibliaParaGuion(datos.biblia)}
${nota ? `\nNOTA DEL DIRECTOR PARA ESTE EPISODIO:\nObjetivo: ${nota.objetivo}\nCurva emocional: ${nota.curvaEmocional}\nImagen clave (tiene que ocurrir): ${nota.imagenClave}\nNota: ${nota.notaDeDireccion}\n${f.cierre === 'suspenso' ? 'Queda abierto' : 'Posibilidad futura opcional'}: ${nota.quedaAbierto}` : ''}

${ANATOMIA_FORMATO}

${REGLAS_ESCRITURA}
${esEcchi(f) ? '\n' + REGLAS_ECCHI_GUION + '\n' : ''}${canon ? `\n═══ GUION YA ESCRITO (canon inmediato: continúa desde aquí, no lo repitas ni lo resumas) ═══\n${canon}\n═══ FIN DEL GUION YA ESCRITO ═══\n` : ''}
ESCRIBE AHORA: ${textoFase(pieza.fase, f.cierre)}
${pieza.parte ? `Este es un TROZO (${pieza.parte}) de esa fase: escribe solo esa parte y deja la historia lista para seguir.` : ''}
- Unas ${pieza.palabras} palabras habladas en total (diálogo, pensamiento${u.tieneSistema ? ' y Sistema' : ''}). MÍNIMO ${Math.ceil(pieza.palabras * 0.9)}: un bloque más corto se rechaza.
- Al menos ${pieza.ciclos} ciclo(s) de retención COMPLETOS (problema → solución → reacción de los demás → recompensa visible).
- Escenas de 40 a 150 palabras cada una. Ninguna escena vacía ni de relleno.
- El pensamiento («pensamiento») es SOLO del protagonista (${protagonista.id} = ${protagonista.nombre}) y va antes de su jugada.${u.tieneSistema ? '\n- Las líneas del Sistema llevan "tipo":"sistema" y "personaje":null. Son paneles o notificaciones breves.' : ''}
- "accion" describe lo que SE VE al empezar la escena (personas, gesto, lugar) en 1 o 2 frases concretas; no se lee en voz alta.
- Los personajes del reparto se nombran con su id. Un extra sin ficha (un soldado, un mercader) lleva "personaje":"extra" y su "nombre".
${indice > 0 ? '- Empieza justo después de la última acción del guion ya escrito. No reinicies la premisa.' : ''}
${indice < plan.length - 1 ? '- Este bloque NO es el final del episodio.' : ''}
${extra}

Devuelve JSON:
{
  "escenas": [{"titulo": "…", "escenario": "l1", "personajes": ["c1"], "accion": "…", "lineas": [{"tipo": ${tipos}, "personaje": "c1", "texto": "lo que se oye"}]}],
  "ciclos": [{"problema": "…", "solucion": "…", "reaccion": "…", "recompensa": "…", "citaProblema": "6 a 20 palabras COPIADAS LITERALMENTE de las líneas", "citaReaccion": "…", "citaRecompensa": "…"}],
  "huellas": [${huellasPedidas(f).map(h => `{"de": "${h.clave}", "cita": "4 a 20 palabras COPIADAS LITERALMENTE de las líneas o de la acción donde se nota ${h.etiqueta}"}`).join(', ')}],
  ${esApertura ? '"apertura": {"citaConflicto": "6 a 20 palabras literales del conflicto inicial", "citaElemento": "6 a 20 palabras literales donde aparece el elemento especial"},\n  ' : ''}"resumen": "2 o 3 frases con lo que pasa en este bloque"
}
Las citas se copian EXACTAMENTE de los textos de "lineas", en el mismo orden en que ocurren. Las de "huellas" pueden salir también de "accion".
"huellas" demuestra que el género y CADA subgénero elegido se notan en ESTE bloque: un bloque donde alguno no se nota se rechaza.`,
    temperatura: 0.75,
  };
}
