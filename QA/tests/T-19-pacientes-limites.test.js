/** Reglas clínicas, consultas y errores de actualización en datos sintéticos. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,createPatient,cleanPatient}=require('../helpers/fixtures');

describe('T-19 | Pacientes: casos límite y seguridad',()=>{
 test('T-19.01 consulta por ID sin token es rechazada',async()=>{
  expect((await request('GET','/pacientes/987654321')).status).toBe(401);
 });
 test('T-19.02 consulta por ID inexistente devuelve 404 para admin',async()=>{
  expect((await request('GET','/pacientes/987654321',{token:await login('admin')})).status).toBe(404);
 });
 test('T-19.03 paciente propio puede consultar su ficha',async()=>{
  const q=await query("SELECT id FROM pacientes WHERE rut='99999999-9'");
  const r=await request('GET',`/pacientes/${q.rows[0].id}`,{token:await login('paciente')});
  expect(r.status).toBe(200);expect(String(r.json.id)).toBe(String(q.rows[0].id));
 });
 test('T-19.04 edición de paciente sin token se rechaza',async()=>{
  const p=await createPatient();try{expect((await request('PUT',`/pacientes/${p.id}`,{body:{telefono:'999111111'}})).status).toBe(401);}finally{await cleanPatient(p.id);}
 });
 test('T-19.05 paciente no cambia datos clínicos ajenos',async()=>{
  const p=await createPatient();try{expect((await request('PUT',`/pacientes/${p.id}`,{token:await login('paciente'),body:{alergias:'No autorizado QA'}})).status).toBe(403);}finally{await cleanPatient(p.id);}
 });
 test('T-19.06 administrador no actualiza ID inexistente',async()=>{
  expect((await request('PUT','/pacientes/987654321',{token:await login('admin'),body:{telefono:'111111111'}})).status).toBe(404);
 });
 test('T-19.07 crear un RUT ya registrado informa duplicado',async()=>{
  const p=await createPatient();try{
   const r=await request('POST','/pacientes',{token:await login('admin'),body:{rut:p.rut,primer_nombre:'QA',apellido_paterno:'Duplicado',fecha_nacimiento:'2000-01-01',sexo:'O',email:`qa_${suffix()}@qa.invalid`}});
   expect(r.status).toBe(400);
  }finally{await cleanPatient(p.id);}
 });
 test('T-19.08 paciente no puede eliminar ficha, incluso temporal',async()=>{
  const p=await createPatient();try{
   const r=await request('DELETE',`/pacientes/${p.id}`,{token:await login('paciente')});
   expect(r.status).toBe(403);
   const q=await query('SELECT id FROM pacientes WHERE id=$1',[p.id]);expect(q.rowCount).toBe(1);
  }finally{await cleanPatient(p.id);}
 });
 test('T-19.09 eliminación sin sesión es rechazada',async()=>{
  expect((await request('DELETE','/pacientes/987654321')).status).toBe(401);
 });
 test('T-19.10 eliminación admin de paciente inexistente devuelve 404',async()=>{
  expect((await request('DELETE','/pacientes/987654321',{token:await login('admin')})).status).toBe(404);
 });
});
