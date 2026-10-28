const fs = require('node:fs'); const path = require('node:path');
const dir = path.resolve(__dirname,'../evidencias');
function record(id, data) {
  fs.mkdirSync(dir, {recursive:true});
  // Solo metadatos de prueba: jamás almacenar JWT, contraseñas o ficha clínica completa.
  const payload = {caso:id, registrado_en:new Date().toISOString(), ...data};
  fs.writeFileSync(path.join(dir,`${id}.json`),JSON.stringify(payload,null,2)+'\n','utf8');
}
module.exports = {record};
