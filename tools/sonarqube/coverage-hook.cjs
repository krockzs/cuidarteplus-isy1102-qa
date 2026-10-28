'use strict';
// Precarga EXTERNA de QA: exporta cobertura V8 al terminar la API de laboratorio.
// No modifica ni instrumenta en disco el código fuente original.
const v8 = require('node:v8');
process.on('SIGTERM', () => {
  try {
    v8.takeCoverage();
    console.log('[QA] Cobertura V8 exportada al finalizar la API instrumentada.');
    process.exit(0);
  } catch (error) {
    console.error('[QA] No se pudo exportar la cobertura:', error.message);
    process.exit(2);
  }
});
