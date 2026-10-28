const {request}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,cleanUser}=require('../helpers/fixtures');
const {record}=require('../helpers/evidence');
test('T-06 | RUT con dígito verificador erróneo debe rechazarse',async()=>{
 const name='qa_ep3_'+suffix();const rut='12345678-0';let status=0,created=false;
 try{
  const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:name,password:'ContrasenaSinteticaQA!2026',correo:`${name}@qa.invalid`,rut}});status=r.status;
  const s=await query('SELECT id FROM usuarios WHERE nombre_usuario=$1',[name]);created=s.rowCount>0;
  record('T-06',{metodo:'POST',ruta:'/autenticacion/registro',tipo:'rut_con_digito_invalido',http:status,usuario_creado:created,esperado:'HTTP 400/422; no debe crear la cuenta'});
 }finally{
   await query('DELETE FROM pacientes WHERE usuario_id IN (SELECT id FROM usuarios WHERE nombre_usuario=$1)',[name]);
   await cleanUser(name);
 }
 expect([400,422]).toContain(status);expect(created).toBe(false);
});
