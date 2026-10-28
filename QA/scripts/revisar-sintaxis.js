const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const dir=path.resolve(__dirname,'../../BACKEND/src');let count=0,failed=0;
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){
 const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.js')){
  count++;const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0){failed++;console.error(f,r.stderr);} }
}}walk(dir);console.log(`Archivos JS backend: ${count} | errores sintácticos: ${failed}`);
process.exitCode=failed?1:0;
