const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..'),dir=path.join(base,'reportes');
const infile=path.join(dir,'jest-resultados.json');
if(!fs.existsSync(infile)){console.error('Sin resultados Jest; ejecuta scripts/02-ejecutar-jest.sh');process.exit(1);}
const raw=JSON.parse(fs.readFileSync(infile,'utf8'));
const names={
 'T-01':'Autorización de roles','T-02':'Confidencialidad clínica','T-03':'Conservación de ficha',
 'T-04':'Auditoría de modificación real','T-05':'Protección criptográfica','T-06':'Validación de RUT',
 'T-07':'Rendimiento <= 2 segundos','T-08':'Usabilidad / búsqueda por médico (manual)',
 'T-09':'Validación de contenido en archivos'
};
const byId={};for(const suite of raw.testResults||[]){const m=suite.name.match(/T-0[1-9]/);if(!m)continue;
 const test=suite.assertionResults[0],id=m[0];byId[id]={estado:test.status==='passed'?'CUMPLE':test.status==='failed'?'NO CUMPLE':'BLOQUEADO',
 duracion_ms:test.duration ?? null,mensaje:(test.failureMessages||[]).join('\n').slice(0,2500)};}
const evidence=path.join(base,'evidencias');
const cases=Object.keys(names).map(id=>{
 let ev=null;try{ev=JSON.parse(fs.readFileSync(path.join(evidence,id+'.json'),'utf8'));}catch{}
 const info=byId[id]||{estado:'PENDIENTE'};
 if(id!=='T-08' && info.estado==='NO CUMPLE' && !ev) info.estado='BLOQUEADO';
 if(id==='T-08' && ev?.estado) info.estado=ev.estado;
 return {id,descripcion:names[id],...info,evidencia:ev};
});
function esc(x){return String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const counts=cases.reduce((a,c)=>(a[c.estado]=(a[c.estado]||0)+1,a),{});
const rows=cases.map(c=>`<tr><td>${esc(c.id)}</td><td>${esc(c.descripcion)}</td><td class="${c.estado==='CUMPLE'?'ok':c.estado==='NO CUMPLE'?'fail':'pending'}">${esc(c.estado)}</td><td>${c.duracion_ms??'—'}</td><td><pre>${esc(JSON.stringify(c.evidencia||{},null,2))}</pre></td></tr>`).join('\n');
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EP3 - Cuidarte+ - Jest</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f7fb;color:#1a2234;margin:0;padding:2rem}main{max-width:1200px;margin:auto}h1{margin-bottom:.2rem}small{color:#566}table{border-collapse:collapse;width:100%;background:white;box-shadow:0 2px 16px #dce1e9;border-radius:10px;overflow:hidden}th,td{padding:12px;border-bottom:1px solid #e4e7ef;text-align:left;vertical-align:top}th{background:#1a2740;color:white}td pre{max-width:510px;white-space:pre-wrap;word-break:break-word;font-size:12px}.ok{color:#147241;font-weight:700}.fail{color:#a3212b;font-weight:700}.pending{color:#8d5b18;font-weight:700}.cards{display:flex;gap:12px;margin:1.2rem 0}.cards div{background:white;padding:16px 24px;border-radius:10px;box-shadow:0 2px 8px #dde}a{color:#1674b9}</style></head><body><main><h1>Cuidarte+ · Auditoría con Jest</h1><small>EP3 ISY1102 · resultados reales. CUMPLE = el sistema satisface el criterio; NO CUMPLE = desviación detectada. T-08 se documenta manualmente.</small><div class="cards">${Object.entries(counts).map(([k,v])=>`<div><b>${esc(k)}</b><p>${v}</p></div>`).join('')}</div><table><thead><tr><th>Caso</th><th>Dimensión</th><th>Estado</th><th>Duración</th><th>Evidencia técnica (sin datos personales ni secretos)</th></tr></thead><tbody>${rows}</tbody></table><p><small>No acredita por sí solo cumplimiento ISO ni cobertura ERS. Laboratorio sintético aislado. No subir datos reales al repositorio.</small></p></main></body></html>`;
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'reporte-ep3.html'),html);
fs.writeFileSync(path.join(dir,'resumen-ep3.txt'),cases.map(c=>`${c.id} | ${c.descripcion} | ${c.estado} | ${JSON.stringify(c.evidencia||{})}`).join('\n')+'\n');
fs.writeFileSync(path.join(dir,'resumen-ep3.json'),JSON.stringify({fecha:new Date().toISOString(),totales:counts,casos:cases},null,2)+'\n');
console.log('Reportes: QA/reportes/{reporte-ep3.html,resumen-ep3.txt,resumen-ep3.json}');
