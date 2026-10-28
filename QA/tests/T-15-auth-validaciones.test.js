// T-15: comprobación de contratos de autenticación sobre usuarios de laboratorio.
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,cleanUser}=require('../helpers/fixtures');

describe('T-15 | Autenticación y validaciones',()=>{
 test('T-15.01 login correcto entrega token',async()=>{
  const r=await request('POST','/autenticacion/login',{body:{nombre_usuario:'qa_admin',password:'demo_admin_qa'}});
  expect(r.status).toBe(200);expect(typeof r.json.token).toBe('string');
 });
 test('T-15.02 contraseña incorrecta debe rechazarse',async()=>{
  const r=await request('POST','/autenticacion/login',{body:{nombre_usuario:'qa_admin',password:'Erronea2026'}});
  expect(r.status).toBe(401);
 });
 test('T-15.03 usuario inexistente debe rechazarse',async()=>{
  const r=await request('POST','/autenticacion/login',{body:{nombre_usuario:'qa_inexistente_2026',password:'Error2026'}});
  expect(r.status).toBe(401);
 });
 test('T-15.04 login sin contraseña se invalida antes de DB',async()=>{
  const r=await request('POST','/autenticacion/login',{body:{nombre_usuario:'qa_admin'}});
  expect(r.status).toBe(400);
 });
 test('T-15.05 registro duplicado es rechazado',async()=>{
  const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:'qa_admin',password:'SoloQA2026!',correo:'nuevo@qa.invalid'}});
  expect(r.status).toBe(400);
 });
 test('T-15.06 registro con correo inválido no crea cuenta',async()=>{
  const name='qa_amplia_'+suffix();
  const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:name,password:'SoloQA2026!',correo:'sin-arroba'}});
  expect(r.status).toBe(400);
  const db=await query('SELECT id FROM usuarios WHERE nombre_usuario=$1',[name]);expect(db.rowCount).toBe(0);
 });
 test('T-15.07 registro correcto sin RUT genera cuenta de paciente',async()=>{
  const name='qa_amplia_'+suffix();try{
   const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:name,password:'SoloQA2026!',correo:`${name}@qa.invalid`}});
   expect(r.status).toBe(201);
   const db=await query(`SELECT r.nombre FROM usuarios u JOIN usuario_roles ur ON u.id=ur.usuario_id
      JOIN roles r ON ur.rol_id=r.id WHERE u.nombre_usuario=$1`,[name]);
   expect(db.rows.some(x=>x.nombre==='paciente')).toBe(true);
  }finally{await cleanUser(name);}
 });
});
