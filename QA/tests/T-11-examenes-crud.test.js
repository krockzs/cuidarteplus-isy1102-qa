// T-11: cubrir rutas de exámenes con datos sintéticos y limpieza.
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {createPatient,createExam,cleanPatient}=require('../helpers/fixtures');

async function examBody(patientId){
 const t=await query('SELECT id FROM tipo_examen_medico ORDER BY id LIMIT 1');
 return {tipo_examen_medico_id:t.rows[0].id,paciente_id:patientId,diagnosis:'Diagnóstico de laboratorio QA',observaciones:'Prueba automatizada'};
}

describe('T-11 | Exámenes: consulta, autorización, CRUD',()=>{
 test('T-11.01 consulta de exámenes sin token es rechazada',async()=>{
  expect((await request('GET','/examenes',{timeoutMs:13000})).status).toBe(401);
 },17000);
 test('T-11.02 administrador puede listar exámenes',async()=>{
  const r=await request('GET','/examenes',{token:await login('admin'),timeoutMs:13000});
  expect(r.status).toBe(200);expect(Array.isArray(r.json)).toBe(true);
 },17000);
 test('T-11.03 paciente solo ve sus exámenes al listar',async()=>{
  const r=await request('GET','/examenes',{token:await login('paciente'),timeoutMs:13000});
  expect(r.status).toBe(200);expect(Array.isArray(r.json)).toBe(true);
  const p=await query("SELECT id FROM pacientes WHERE usuario_id=(SELECT id FROM usuarios WHERE nombre_usuario='qa_paciente')");
  expect(r.json.every(e=>String(e.paciente_id)===String(p.rows[0].id))).toBe(true);
 },17000);
 test('T-11.04 administrador consulta un examen y el inexistente devuelve 404',async()=>{
  const p=await createPatient();try{
   const eid=await createExam(p.id),token=await login('admin');
   const found=await request('GET',`/examenes/${eid}`,{token});
   expect(found.status).toBe(200);expect(String(found.json.id)).toBe(String(eid));
   expect((await request('GET','/examenes/987654321',{token})).status).toBe(404);
  }finally{await cleanPatient(p.id);}
 });
 test('T-11.05 paciente no consulta examen ajeno por ID',async()=>{
  const p=await createPatient();try{
   const eid=await createExam(p.id);
   const r=await request('GET',`/examenes/${eid}`,{token:await login('paciente')});
   expect([403,404]).toContain(r.status);
  }finally{await cleanPatient(p.id);}
 });
 test('T-11.06 listado por paciente comprueba propiedad',async()=>{
  const p=await createPatient();try{
   const eid=await createExam(p.id),admin=await login('admin'),patient=await login('paciente');
   const r=await request('GET',`/examenes/paciente/${p.id}`,{token:admin});
   expect(r.status).toBe(200);expect(r.json.some(e=>String(e.id)===String(eid))).toBe(true);
   expect((await request('GET',`/examenes/paciente/${p.id}`,{token:patient})).status).toBe(403);
  }finally{await cleanPatient(p.id);}
 });
 test('T-11.07 médico crea examen válido; la BD confirma persistencia',async()=>{
  const p=await createPatient();try{
   const r=await request('POST','/examenes',{token:await login('medico'),body:await examBody(p.id),timeoutMs:14000});
   expect(r.status).toBe(201);
   const db=await query('SELECT id FROM examen_medico WHERE id=$1 AND paciente_id=$2',[r.json.id,p.id]);
   expect(db.rowCount).toBe(1);
  }finally{await cleanPatient(p.id);}
 },18000);
 test('T-11.08 paciente no puede crear examen',async()=>{
  const p=await createPatient();try{
   expect((await request('POST','/examenes',{token:await login('paciente'),body:await examBody(p.id),timeoutMs:14000})).status).toBe(403);
  }finally{await cleanPatient(p.id);}
 },18000);
 test('T-11.09 validación impide examen sin paciente o tipo',async()=>{
  const r=await request('POST','/examenes',{token:await login('medico'),body:{diagnosis:'Sin identificadores'},timeoutMs:14000});
  expect(r.status).toBe(400);
 },18000);
 test('T-11.10 administrador actualiza examen existente',async()=>{
  const p=await createPatient();try{
   const eid=await createExam(p.id);
   const r=await request('PUT',`/examenes/${eid}`,{token:await login('admin'),body:{diagnosis:'Diagnóstico QA actualizado'},timeoutMs:14000});
   expect(r.status).toBe(200);
   const db=await query('SELECT diagnosis FROM examen_medico WHERE id=$1',[eid]);
   expect(db.rows[0].diagnosis).toBe('Diagnóstico QA actualizado');
  }finally{await cleanPatient(p.id);}
 },18000);
 test('T-11.11 actualización sin datos se rechaza',async()=>{
  const p=await createPatient();try{
   const eid=await createExam(p.id);
   const r=await request('PUT',`/examenes/${eid}`,{token:await login('admin'),body:{},timeoutMs:14000});
   expect(r.status).toBe(400);
  }finally{await cleanPatient(p.id);}
 },18000);
 test('T-11.12 paciente no elimina exámenes; administrador elimina temporal',async()=>{
  const p=await createPatient();try{
   const eid=await createExam(p.id);
   expect((await request('DELETE',`/examenes/${eid}`,{token:await login('paciente')})).status).toBe(403);
   const removed=await request('DELETE',`/examenes/${eid}`,{token:await login('admin')});
   expect(removed.status).toBe(200);
   const db=await query('SELECT id FROM examen_medico WHERE id=$1',[eid]);expect(db.rowCount).toBe(0);
  }finally{await cleanPatient(p.id);}
 });
});
