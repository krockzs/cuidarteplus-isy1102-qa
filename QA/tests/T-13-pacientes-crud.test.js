// T-13: rutas de pacientes con identidad sintética y limpieza.
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,createPatient,cleanPatient}=require('../helpers/fixtures');

describe('T-13 | Pacientes: CRUD, permisos y validaciones',()=>{
 test('T-13.01 registro de paciente exige sesión',async()=>{
  const s=suffix();const payload={rut:'10123456-7',primer_nombre:'QA',apellido_paterno:'Aislado',fecha_nacimiento:'2000-01-01',sexo:'O',email:`qa_${s}@qa.invalid`};
  const r=await request('POST','/pacientes',{body:payload});
  expect(r.status).toBe(401);
 });
 test('T-13.02 registro inválido es rechazado por esquema',async()=>{
  const r=await request('POST','/pacientes',{token:await login('admin'),body:{primer_nombre:'X',email:'erroneo'}});
  expect(r.status).toBe(400);
 });
 test('T-13.03 médico crea paciente y consulta su ficha',async()=>{
  const tag=suffix(),rut=`${Math.floor(Math.random()*89000000+10000000)}-9`;
  let id=null;
  try{
   const body={rut,primer_nombre:'QA',apellido_paterno:'Temporal',fecha_nacimiento:'2001-01-01',sexo:'O',email:`qa_${tag}@qa.invalid`};
   const r=await request('POST','/pacientes',{token:await login('medico'),body});
   expect(r.status).toBe(201);id=r.json.id;
   const read=await request('GET',`/pacientes/${id}`,{token:await login('medico')});
   expect(read.status).toBe(200);expect(read.json.primer_nombre).toBe('QA');
  }finally{if(id) await cleanPatient(id);}
 });
 test('T-13.04 paciente no puede registrar fichas',async()=>{
  const tag=suffix();const body={rut:'12555789-7',primer_nombre:'QA',apellido_paterno:'Temporal',fecha_nacimiento:'2001-01-01',sexo:'O',email:`qa_${tag}@qa.invalid`};
  expect((await request('POST','/pacientes',{token:await login('paciente'),body})).status).toBe(403);
 });
 test('T-13.05 paciente no lee ficha clínica ajena por ID',async()=>{
  const p=await createPatient();try{
   expect((await request('GET',`/pacientes/${p.id}`,{token:await login('paciente')})).status).toBe(403);
  }finally{await cleanPatient(p.id);}
 });
 test('T-13.06 administrador consulta paciente por RUT y el inexistente responde 404',async()=>{
  const p=await createPatient();try{
   const r=await request('GET',`/pacientes/buscar/rut/${encodeURIComponent(p.rut)}`,{token:await login('admin')});
   expect(r.status).toBe(200);expect(String(r.json.id)).toBe(String(p.id));
   expect((await request('GET','/pacientes/buscar/rut/10000000-0',{token:await login('admin')})).status).toBe(404);
  }finally{await cleanPatient(p.id);}
 });
 test('T-13.07 actualiza paciente y verifica persistencia en PostgreSQL',async()=>{
  const p=await createPatient();try{
   const r=await request('PUT',`/pacientes/${p.id}`,{token:await login('admin'),body:{telefono:'555000111'}});
   expect(r.status).toBe(200);
   const db=await query('SELECT telefono FROM pacientes WHERE id=$1',[p.id]);expect(db.rows[0].telefono).toBe('555000111');
  }finally{await cleanPatient(p.id);}
 });
 test('T-13.08 actualización vacía es rechazada',async()=>{
  const p=await createPatient();try{
   const r=await request('PUT',`/pacientes/${p.id}`,{token:await login('admin'),body:{}});
   expect(r.status).toBe(400);
  }finally{await cleanPatient(p.id);}
 });
 test('T-13.09 administrador elimina un paciente temporal sin exámenes',async()=>{
  const p=await createPatient();try{
   const r=await request('DELETE',`/pacientes/${p.id}`,{token:await login('admin')});
   expect(r.status).toBe(200);
   const db=await query('SELECT id FROM pacientes WHERE id=$1',[p.id]);expect(db.rowCount).toBe(0);
  }finally{await cleanPatient(p.id);}
 });
});
