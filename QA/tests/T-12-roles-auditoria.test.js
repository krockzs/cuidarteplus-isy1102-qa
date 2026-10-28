// T-12: roles temporales y auditoría real de acciones del laboratorio.
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix}=require('../helpers/fixtures');

describe('T-12 | Roles y auditoría',()=>{
 test('T-12.01 consulta de tipos de rol registrados',async()=>{
  const r=await request('GET','/roles',{token:await login('admin')});
  expect(r.status).toBe(200);expect(r.json.some(x=>x.nombre==='admin')).toBe(true);
 });
 test('T-12.02 consulta de rol existente y ausente',async()=>{
  const db=await query("SELECT id FROM roles WHERE nombre='paciente'");
  const a=await request('GET',`/roles/${db.rows[0].id}`,{token:await login('admin')});
  expect(a.status).toBe(200);expect(a.json.nombre).toBe('paciente');
  expect((await request('GET','/roles/987654321',{token:await login('admin')})).status).toBe(404);
 });
 test('T-12.03 operaciones de rol sin sesión deben denegarse (registro real)',async()=>{
  const nombre=`qa_rol_${suffix()}`,nuevo=`qa_new_${suffix()}`;
  let id=null;let createStatus=0,updateStatus=0,deleteStatus=0;
  try{
   // Se hacen las tres operaciones solo sobre el rol temporal del laboratorio.
   const a=await request('POST','/roles',{body:{nombre}});createStatus=a.status;
   if(a.status===201 && a.json?.id){
    id=a.json.id;
    const b=await request('PUT',`/roles/${id}`,{body:{nombre:nuevo}});updateStatus=b.status;
    const c=await request('DELETE',`/roles/${id}`);deleteStatus=c.status;
   }
   // Si el control funciona, la primera solicitud debe rechazarla sin crear nada.
   expect([401,403]).toContain(createStatus);
  }finally{
   if(id!==null) await query('DELETE FROM roles WHERE id=$1',[id]);
   await query('DELETE FROM roles WHERE nombre=$1 OR nombre=$2',[nombre,nuevo]);
  }
 });
 test('T-12.04 anónimo no debería consultar roles del sistema',async()=>{
  const r=await request('GET','/roles');
  expect([401,403]).toContain(r.status);
 });
 test('T-12.05 sin autenticación no se consulta auditoría',async()=>{
  expect((await request('GET','/auditoria')).status).toBe(401);
 });
 test('T-12.06 pacientes no pueden consultar auditoría global',async()=>{
  expect((await request('GET','/auditoria',{token:await login('paciente')})).status).toBe(403);
 });
 test('T-12.07 administrador consulta registros de auditoría reales',async()=>{
  const r=await request('GET','/auditoria',{token:await login('admin')});
  expect(r.status).toBe(200);expect(Array.isArray(r.json)).toBe(true);
  expect(r.json.length).toBeGreaterThan(0);
 });
});
