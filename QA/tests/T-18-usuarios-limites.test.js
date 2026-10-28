/** Pruebas de autorización y casos límite del módulo de usuarios. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,cleanUser}=require('../helpers/fixtures');

async function userId(name){const q=await query('SELECT id FROM usuarios WHERE nombre_usuario=$1',[name]);return q.rows[0].id;}
async function temporaryUser(){const name='qa_users_'+suffix();const r=await query('INSERT INTO usuarios(nombre_usuario,contrasena,correo) VALUES($1,$2,$3) RETURNING id',[name,'qaPassword2026!',`${name}@qa.invalid`]);return {name,id:r.rows[0].id};}
describe('T-18 | Usuarios: límites, roles y respuestas',()=>{
 test('T-18.01 actualización sin token se rechaza',async()=>{
  expect((await request('PUT',`/usuarios/${await userId('qa_admin')}`,{body:{correo:'qa@qa.invalid'}})).status).toBe(401);
 });
 test('T-18.02 paciente no puede consultar un usuario administrativo',async()=>{
  expect((await request('GET',`/usuarios/${await userId('qa_admin')}`,{token:await login('paciente')})).status).toBe(403);
 });
 test('T-18.03 modificar un usuario inexistente responde 404',async()=>{
  expect((await request('PUT','/usuarios/987654321',{token:await login('admin'),body:{correo:'unico@qa.invalid'}})).status).toBe(404);
 });
 test('T-18.04 paciente no puede cambiar su propio rol',async()=>{
  const id=await userId('qa_paciente');const role=await query("SELECT id FROM roles WHERE nombre='admin'");
  expect((await request('PUT',`/usuarios/${id}`,{token:await login('paciente'),body:{rol_id:role.rows[0].id}})).status).toBe(403);
 });
 test('T-18.05 paciente no puede eliminar una cuenta ajena',async()=>{
  const t=await temporaryUser();let r;
  try{
   r=await request('DELETE',`/usuarios/${t.id}`,{token:await login('paciente')});
   const q=await query('SELECT id FROM usuarios WHERE id=$1',[t.id]);
   expect([401,403]).toContain(r.status);expect(q.rowCount).toBe(1);
  }finally{await cleanUser(t.name);}
 });
 test('T-18.06 eliminación anónima de usuario se rechaza sin efectos',async()=>{
  const t=await temporaryUser();
  try{
   const r=await request('DELETE',`/usuarios/${t.id}`);
   const q=await query('SELECT id FROM usuarios WHERE id=$1',[t.id]);
   expect([401,403]).toContain(r.status);expect(q.rowCount).toBe(1);
  }finally{await cleanUser(t.name);}
 });
 test('T-18.07 creación de usuario duplicado devuelve error de cliente',async()=>{
  const token=await login('admin');
  const r=await request('POST','/usuarios',{token,body:{nombre_usuario:'qa_paciente',contrasena_hash:'qaPassword2026!',correo:'duplicado@qa.invalid'}});
  expect([400,409,422]).toContain(r.status);
 });
});
