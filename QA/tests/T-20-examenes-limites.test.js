/** Reglas de acceso y fallas controladas de exámenes médicos. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {createPatient,createExam,cleanPatient}=require('../helpers/fixtures');

describe('T-20 | Exámenes: límites, propiedad y eliminación',()=>{
 test('T-20.01 consulta de examen por ID sin sesión se rechaza',async()=>{
  expect((await request('GET','/examenes/987654321')).status).toBe(401);
 });
 test('T-20.02 consulta de examen por ID con token inválido se rechaza',async()=>{
  expect((await request('GET','/examenes/987654321',{token:'token.invalido'})).status).toBe(401);
 });
 test('T-20.03 paciente consulta un examen clínico propio',async()=>{
  const db=await query("SELECT em.id FROM examen_medico em JOIN pacientes p ON em.paciente_id=p.id WHERE p.rut='99999999-9' LIMIT 1");
  expect(db.rowCount).toBe(1);
  const r=await request('GET',`/examenes/${db.rows[0].id}`,{token:await login('paciente')});
  expect(r.status).toBe(200);expect(String(r.json.id)).toBe(String(db.rows[0].id));
 });
 test('T-20.04 consulta por paciente sin sesión se rechaza',async()=>{
  const p=await createPatient();try{expect((await request('GET',`/examenes/paciente/${p.id}`)).status).toBe(401);}finally{await cleanPatient(p.id);}
 });
 test('T-20.05 médico consulta exámenes de un paciente temporal',async()=>{
  const p=await createPatient();try{
   const id=await createExam(p.id);
   const r=await request('GET',`/examenes/paciente/${p.id}`,{token:await login('medico')});
   expect(r.status).toBe(200);expect(r.json.some(e=>String(e.id)===String(id))).toBe(true);
  }finally{await cleanPatient(p.id);}
 });
 test('T-20.06 actualización de examen inexistente devuelve 404',async()=>{
  const r=await request('PUT','/examenes/987654321',{token:await login('admin'),body:{diagnosis:'Sin existencia QA'},timeoutMs:14000});
  expect(r.status).toBe(404);
 },17500);
 test('T-20.07 eliminación de examen sin token se rechaza',async()=>{
  expect((await request('DELETE','/examenes/987654321')).status).toBe(401);
 });
 test('T-20.08 eliminación de examen inexistente por admin devuelve 404',async()=>{
  expect((await request('DELETE','/examenes/987654321',{token:await login('admin')})).status).toBe(404);
 });
 test('T-20.09 crear examen para paciente inexistente debe rechazarlo como error del cliente',async()=>{
  const q=await query('SELECT id FROM tipo_examen_medico LIMIT 1');
  const r=await request('POST','/examenes',{token:await login('admin'),body:{tipo_examen_medico_id:q.rows[0].id,paciente_id:987654321},timeoutMs:14000});
  expect([400,404,409,422]).toContain(r.status);
 },17500);
});
