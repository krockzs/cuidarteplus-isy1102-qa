/** Casos adicionales de identidad; usuarios y datos exclusivamente sintéticos. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,createPatient,cleanPatient,cleanUser}=require('../helpers/fixtures');

describe('T-17 | Identidad, sesiones y vinculación de pacientes',()=>{
 test('T-17.01 JWT inválido no permite listar usuarios',async()=>{
  expect((await request('GET','/usuarios',{token:'jwt.que.no.es.valido'})).status).toBe(401);
 });
 test('T-17.02 JWT inválido no permite consultar exámenes por ID',async()=>{
  expect((await request('GET','/examenes/987654321',{token:'jwt.que.no.es.valido'})).status).toBe(401);
 });
 test('T-17.03 JWT inválido no permite acceder a auditoría',async()=>{
  expect((await request('GET','/auditoria',{token:'jwt.que.no.es.valido'})).status).toBe(401);
 });
 test('T-17.04 JWT inválido no permite consultar pacientes por ID',async()=>{
  expect((await request('GET','/pacientes/987654321',{token:'jwt.que.no.es.valido'})).status).toBe(401);
 });
 test('T-17.05 registro con RUT previamente vinculado se rechaza',async()=>{
  const name='qa_id_'+suffix();
  const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:name,password:'qaPassword2026!',correo:`${name}@qa.invalid`,rut:'99999999-9'}});
  expect(r.status).toBe(400);
  const q=await query('SELECT id FROM usuarios WHERE nombre_usuario=$1',[name]);expect(q.rowCount).toBe(0);
 });
 test('T-17.06 registro vincula únicamente paciente temporal sin usuario',async()=>{
  const p=await createPatient(),name='qa_id_'+suffix();
  try{
   const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:name,password:'qaPassword2026!',correo:`${name}@qa.invalid`,rut:p.rut}});
   expect(r.status).toBe(201);
   const q=await query('SELECT p.usuario_id,u.nombre_usuario FROM pacientes p JOIN usuarios u ON p.usuario_id=u.id WHERE p.id=$1',[p.id]);
   expect(q.rowCount).toBe(1); expect(q.rows[0].nombre_usuario).toBe(name);
  }finally{await cleanUser(name);await cleanPatient(p.id);}
 });
 test('T-17.07 intento de login con usuario sin roles no otorga privilegios',async()=>{
  const name='qa_id_'+suffix();
  await query('INSERT INTO usuarios(nombre_usuario,contrasena,correo) VALUES ($1,$2,$3)',[name,'qaPassword2026!',`${name}@qa.invalid`]);
  try{
   const r=await request('POST','/autenticacion/login',{body:{nombre_usuario:name,password:'qaPassword2026!'}});
   expect(r.status).toBe(200);expect(r.json?.token).toEqual(expect.any(String));
   const check=await request('GET','/usuarios',{token:r.json.token});expect(check.status).toBe(403);
  }finally{await cleanUser(name);}
 });
});
