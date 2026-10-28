/** Pruebas de controles de acceso en catálogo de roles de laboratorio. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix}=require('../helpers/fixtures');

describe('T-22 | Roles: autorización y operaciones límite',()=>{
 test('T-22.01 lectura por ID sin token no debería revelar roles administrativos',async()=>{
  const q=await query("SELECT id FROM roles WHERE nombre='admin'");
  expect([401,403]).toContain((await request('GET',`/roles/${q.rows[0].id}`)).status);
 });
 test('T-22.02 actualización anónima de rol temporal debe denegarse',async()=>{
  const name='qa_role_'+suffix();let id;
  try{
   const q=await query('INSERT INTO roles(nombre) VALUES($1) RETURNING id',[name]);id=q.rows[0].id;
   const r=await request('PUT',`/roles/${id}`,{body:{nombre:`${name}_nuevo`}});
   expect([401,403]).toContain(r.status);
   const q2=await query('SELECT nombre FROM roles WHERE id=$1',[id]);expect(q2.rows[0].nombre).toBe(name);
  }finally{if(id) await query('DELETE FROM roles WHERE id=$1',[id]);}
 });
 test('T-22.03 eliminación anónima de rol temporal debe denegarse',async()=>{
  const name='qa_role_'+suffix();let id;
  try{
   const q=await query('INSERT INTO roles(nombre) VALUES($1) RETURNING id',[name]);id=q.rows[0].id;
   const r=await request('DELETE',`/roles/${id}`);
   expect([401,403]).toContain(r.status);
   const q2=await query('SELECT id FROM roles WHERE id=$1',[id]);expect(q2.rowCount).toBe(1);
  }finally{if(id) await query('DELETE FROM roles WHERE id=$1',[id]);}
 });
 test('T-22.04 consulta de rol inexistente responde 404',async()=>{
  expect((await request('GET','/roles/987654321',{token:await login('admin')})).status).toBe(404);
 });
 test('T-22.05 actualización de rol inexistente responde 404',async()=>{
  expect((await request('PUT','/roles/987654321',{token:await login('admin'),body:{nombre:'qa_inexistente'}})).status).toBe(404);
 });
 test('T-22.06 eliminación de rol inexistente responde 404',async()=>{
  expect((await request('DELETE','/roles/987654321',{token:await login('admin')})).status).toBe(404);
 });
});
