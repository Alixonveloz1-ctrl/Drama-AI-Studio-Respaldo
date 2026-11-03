// ════════════════════════════════════════════════════════════════
// AUDIO — utilidades para los WAV que devuelve Google.
//  · Si Google devuelve PCM crudo (16 bits, mono, 24 kHz) se envuelve en un
//    WAV para poder escucharlo y montarlo.
//  · La duración se lee de la cabecera, sin decodificar nada.
// ════════════════════════════════════════════════════════════════

function pcmAWav(pcm, { frecuencia = 24000, canales = 1, bits = 16 } = {}) {
  const cabecera = Buffer.alloc(44);
  const bytesPorSegundo = frecuencia * canales * bits / 8;
  cabecera.write('RIFF', 0);
  cabecera.writeUInt32LE(36 + pcm.length, 4);
  cabecera.write('WAVE', 8);
  cabecera.write('fmt ', 12);
  cabecera.writeUInt32LE(16, 16);
  cabecera.writeUInt16LE(1, 20);
  cabecera.writeUInt16LE(canales, 22);
  cabecera.writeUInt32LE(frecuencia, 24);
  cabecera.writeUInt32LE(bytesPorSegundo, 28);
  cabecera.writeUInt16LE(canales * bits / 8, 32);
  cabecera.writeUInt16LE(bits, 34);
  cabecera.write('data', 36);
  cabecera.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([cabecera, pcm]);
}

// Duración de un WAV en segundos (busca el bloque «data»). null si no lo es.
function duracionWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let pos = 12, bytesPorSegundo = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const tam = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') bytesPorSegundo = buf.readUInt32LE(pos + 16);
    if (id === 'data') return bytesPorSegundo ? Math.min(tam, buf.length - pos - 8) / bytesPorSegundo : null;
    pos += 8 + tam + (tam % 2);
  }
  return null;
}

module.exports = { pcmAWav, duracionWav };
