// T-10: cobertura adicional, sin cambios a BACKEND ni FRONTEND.
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,cleanUser}=require('../helpers/fixtures');

const uid=async(name)=>{
 const r=await query('SELECT id FROM usuarios WHERE nombre_usuario=$1',[name]);
 if(!r.rowCount) throw Error('Cuenta QA no encontrada');
 return r.rows[0].id;
};

describe('T-10 | Usuarios: acceso, CRUD, validación y permisos',()=>{
 test('T-10.01 sin JWT no puede listar usuarios',async()=>{
  expect((await request('GET','/usuarios')).status).toBe(401);
 });
 test('T-10.02 paciente no puede listar usuarios',async()=>{
  expect((await request('GET','/usuarios',{token:await login('paciente')})).status).toBe(403);
 });
 test('T-10.03 administrador consulta listado',async()=>{
  const r=await request('GET','/usuarios',{token:await login('admin')});
  expect(r.status).toBe(200);expect(Array.isArray(r.json)).toBe(true);
  expect(r.json.some(u=>u.nombre_usuario==='qa_admin')).toBe(true);
 });
 test('T-10.04 paciente puede consultar su cuenta, pero no la de otro',async()=>{
  const token=await login('paciente'),self=await uid('qa_paciente'),admin=await uid('qa_admin');
  const own=await request('GET',`/usuarios/${self}`,{token});
  const other=await request('GET',`/usuarios/${admin}`,{token});
  expect(own.status).toBe(200);expect(other.status).toBe(403);
 });
 test('T-10.05 administrador consulta un usuario existente y ausencia de otro',async()=>{
  const token=await login('admin'),id=await uid('qa_paciente');
  expect((await request('GET',`/usuarios/${id}`,{token})).status).toBe(200);
  expect((await request('GET','/usuarios/987654321',{token})).status).toBe(404);
 });
 test('T-10.06 rechaza creación de usuario con entrada inválida',async()=>{
  const token=await login('admin');
  const r=await request('POST','/usuarios',{token,body:{nombre_usuario:'x',contrasena_hash:'a',correo:'invalido'}});
  expect(r.status).toBe(400);expect(r.json?.detalles?.length).toBeGreaterThan(0);
 });
 test('T-10.07 administrador crea una cuenta y queda persistida',async()=>{
  const name='qa_amplia_'+suffix(),token=await login('admin');
  try{
   const r=await request('POST','/usuarios',{token,body:{nombre_usuario:name,contrasena_hash:'SoloQA2026!',correo:`${name}@qa.invalid`}});
   expect(r.status).toBe(201);
   const rows=await query('SELECT id FROM usuarios WHERE nombre_usuario=$1',[name]);
   expect(rows.rowCount).toBe(1);
  }finally{await cleanUser(name);}
 });
 test('T-10.08 administrador actualiza correo y rol de cuenta temporal',async()=>{
  const name='qa_amplia_'+suffix(),token=await login('admin');
  const rol=await query("SELECT id FROM roles WHERE nombre='medico'");
  const insert=await query('INSERT INTO usuarios (nombre_usuario,contrasena,correo) VALUES($1,$2,$3) RETURNING id',[name,'SoloQA2026!',`${name}@qa.invalid`]);
  const id=insert.rows[0].id;
  try{
   const r=await request('PUT',`/usuarios/${id}`,{token,body:{correo:`edit_${name}@qa.invalid`,rol_id:rol.rows[0].id}});
   expect(r.status).toBe(200);
   const rows=await query('SELECT correo FROM usuarios WHERE id=$1',[id]);
   expect(rows.rows[0].correo).toBe(`edit_${name}@qa.invalid`);
   const rs=await query('SELECT COUNT(*)::int n FROM usuario_roles WHERE usuario_id=$1 AND rol_id=$2',[id,rol.rows[0].id]);
   expect(rs.rows[0].n).toBe(1);
  }finally{await cleanUser(name);}
 });
 test('T-10.09 paciente no puede modificar cuenta de administrador',async()=>{
  const token=await login('paciente');
  const id=await uid('qa_admin');
  expect((await request('PUT',`/usuarios/${id}`,{token,body:{correo:'no-permitido@qa.invalid'}})).status).toBe(403);
 });
 test('T-10.10 administrador elimina una cuenta temporal',async()=>{
  const name='qa_amplia_'+suffix();
  const created=await query('INSERT INTO usuarios(nombre_usuario,contrasena,correo) VALUES($1,$2,$3) RETURNING id',[name,'SoloQA2026!',`${name}@qa.invalid`]);
  const id=created.rows[0].id;
  try{
   const r=await request('DELETE',`/usuarios/${id}`,{token:await login('admin')});
   expect(r.status).toBe(200);
   const db=await query('SELECT id FROM usuarios WHERE id=$1',[id]);expect(db.rowCount).toBe(0);
  }finally{await cleanUser(name);}
 });
});
