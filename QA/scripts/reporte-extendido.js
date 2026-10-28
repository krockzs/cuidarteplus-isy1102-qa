// Consolidación local de TODOS los casos Jest. No toca el código de Cuidarte+.
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const folder=path.join(base,'reportes');
const filename=path.join(folder,'jest-resultados.json');
if(!fs.existsSync(filename)) { console.log('[INFO] Falta jest-resultados.json para informe ampliado');process.exit(0); }
const raw=JSON.parse(fs.readFileSync(filename,'utf8'));
const tests=[];
for(const suite of raw.testResults||[]){
 for(const test of suite.assertionResults||[]){
  tests.push({caso:test.fullName||test.title,archivo:path.basename(suite.name),estado:test.status,
   duracion_ms:test.duration??null});
 }
}
const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const style='body{font-family:system-ui,sans-serif;max-width:1150px;margin:32px auto;padding:12px;background:#f6f7fa;color:#17233b}table{border-collapse:collapse;width:100%;background:white}th,td{padding:9px;border:1px solid #d9e1eb;text-align:left}th{background:#243453;color:white}.passed{color:green;font-weight:bold}.failed{color:#b91c1c;font-weight:bold}';
const rows=tests.map(t=>`<tr><td>${escape(t.caso)}</td><td>${escape(t.archivo)}</td><td class="${escape(t.estado)}">${escape(t.estado)}</td><td>${t.duracion_ms??'-'}</td></tr>`).join('');
const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Jest ampliado Cuidarte+</title><style>${style}</style><h1>Jest — suite ampliada</h1><p>${tests.length} verificaciones | ${raw.numPassedTests} PASS | ${raw.numFailedTests} FAIL</p><p>FAIL puede indicar vulnerabilidad comprobada O un problema de prueba; requiere revisar la evidencia. Este reporte no representa cobertura del ERS.</p><table><thead><tr><th>Prueba</th><th>Archivo</th><th>Estado Jest</th><th>Duración (ms)</th></tr></thead><tbody>${rows}</tbody></table></html>`;
fs.writeFileSync(path.join(folder,'reporte-extendido.html'),html);
fs.writeFileSync(path.join(folder,'reporte-extendido.json'),JSON.stringify({totales:{tests:tests.length,pass:raw.numPassedTests,fail:raw.numFailedTests},tests},null,2));
console.log('[OK] Informe extendido:',tests.length,'pruebas');
