/** Verificación de descargas, tipos MIME y restricciones de archivos sintéticos. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {createPatient,createExam,cleanPatient}=require('../helpers/fixtures');
async function seedDoc(examenId,pacienteId,filename){
 const q=await query('INSERT INTO documentos_examen(examen_medico_id,paciente_id,documento,nombre_archivo) VALUES ($1,$2,$3,$4) RETURNING id',[examenId,pacienteId,Buffer.from('CONTENIDO SINTETICO QA'),filename]);
 return q.rows[0].id;
}

describe('T-21 | Documentos: formato, acceso y errores',()=>{
 test('T-21.01 consultar documentos por examen sin token se rechaza',async()=>{
  expect((await request('GET','/documentos/examen/987654321')).status).toBe(401);
 });
 test('T-21.02 token inválido no permite descargar documentos',async()=>{
  expect((await request('GET','/documentos/987654321',{token:'token.invalido'})).status).toBe(401);
 });
 test('T-21.03 listado de documentos propios del paciente es permitido',async()=>{
  const p=await query("SELECT id FROM pacientes WHERE rut='99999999-9'");
  const e=await query('SELECT id FROM examen_medico WHERE paciente_id=$1 LIMIT 1',[p.rows[0].id]);
  const r=await request('GET',`/documentos/examen/${e.rows[0].id}`,{token:await login('paciente')});
  expect(r.status).toBe(200);expect(Array.isArray(r.json)).toBe(true);
 });
 test('T-21.04 listado por examen inexistente devuelve colección vacía para admin',async()=>{
  const r=await request('GET','/documentos/examen/987654321',{token:await login('admin')});
  expect(r.status).toBe(200);expect(r.json).toEqual([]);
 });
 test('T-21.05 una descarga sintética JPG declara MIME image/jpeg',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),d=await seedDoc(e,p.id,'qa-muestra.jpg');
   const token=await login('admin');
   const r=await fetch(`${process.env.QA_API_URL}/documentos/${d}`,{headers:{Authorization:`Bearer ${token}`}});
   expect(r.status).toBe(200);expect(r.headers.get('content-type')).toMatch(/image\/jpeg/);
  }finally{await cleanPatient(p.id);}
 });
 test('T-21.06 descarga sintética PNG declara MIME image/png',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),d=await seedDoc(e,p.id,'qa-muestra.png'),token=await login('admin');
   const r=await fetch(`${process.env.QA_API_URL}/documentos/${d}`,{headers:{Authorization:`Bearer ${token}`}});
   expect(r.status).toBe(200);expect(r.headers.get('content-type')).toMatch(/image\/png/);
  }finally{await cleanPatient(p.id);}
 });
 test('T-21.07 médico puede descargar documento sintético existente',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),d=await seedDoc(e,p.id,'qa-muestra.pdf');
   const r=await request('GET',`/documentos/${d}`,{token:await login('medico')});expect(r.status).toBe(200);
  }finally{await cleanPatient(p.id);}
 });
 test('T-21.08 intento anónimo de eliminar documento debe denegarse',async()=>{
  const p=await createPatient();try{
   const e=await createExam(p.id),d=await seedDoc(e,p.id,'qa-muestra.pdf');
   const r=await request('DELETE',`/documentos/${d}`);
   expect([401,403]).toContain(r.status);
   const q=await query('SELECT id FROM documentos_examen WHERE id=$1',[d]);expect(q.rowCount).toBe(1);
  }finally{await cleanPatient(p.id);}
 });
});
