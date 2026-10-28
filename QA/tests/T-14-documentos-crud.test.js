// T-14: exclusivamente archivos inocuos sintéticos.
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {createPatient,createExam,cleanPatient}=require('../helpers/fixtures');
async function seedDocument(examId,patientId){
 const db=await query(`INSERT INTO documentos_examen (examen_medico_id,paciente_id,documento,nombre_archivo)
 VALUES($1,$2,$3,'qa-ejemplo.pdf') RETURNING id`,[examId,patientId,Buffer.from('%PDF-1.4\n% QA\n')]);
 return db.rows[0].id;
}
describe('T-14 | Documentos: consulta, control de acceso y descarga',()=>{
 test('T-14.01 la descarga anónima está prohibida',async()=>{
  expect((await request('GET','/documentos/987654321')).status).toBe(401);
 });
 test('T-14.02 administrador lista y descarga un archivo sintético existente',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),id=await seedDocument(e,p.id),token=await login('admin');
   const list=await request('GET',`/documentos/examen/${e}`,{token});
   expect(list.status).toBe(200);expect(list.json.some(d=>String(d.id)===String(id))).toBe(true);
   const get=await request('GET',`/documentos/${id}`,{token});expect(get.status).toBe(200);
  }finally{await cleanPatient(p.id);}
 });
 test('T-14.03 paciente no accede a documentos ajenos',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),id=await seedDocument(e,p.id),token=await login('paciente');
   expect((await request('GET',`/documentos/examen/${e}`,{token})).status).toBe(403);
   expect((await request('GET',`/documentos/${id}`,{token})).status).toBe(403);
  }finally{await cleanPatient(p.id);}
 });
 test('T-14.04 documento inexistente responde 404 a administrador',async()=>{
  expect((await request('GET','/documentos/987654321',{token:await login('admin')})).status).toBe(404);
 });
 test('T-14.05 solo administrador elimina archivo temporal',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),id=await seedDocument(e,p.id);
   expect((await request('DELETE',`/documentos/${id}`,{token:await login('paciente')})).status).toBe(403);
   expect((await request('DELETE',`/documentos/${id}`,{token:await login('admin')})).status).toBe(200);
   const db=await query('SELECT id FROM documentos_examen WHERE id=$1',[id]);expect(db.rowCount).toBe(0);
  }finally{await cleanPatient(p.id);}
 });
});
