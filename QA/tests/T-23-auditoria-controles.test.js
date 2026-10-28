/** Registro verificable de auditoría, incluyendo controles de entradas. */
const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix}=require('../helpers/fixtures');

describe('T-23 | Auditoría: integridad y autoría de eventos',()=>{
 test('T-23.01 POST sin token no registra eventos',async()=>{
  const tag='QA_SIN_AUTH_'+suffix();
  const r=await request('POST','/auditoria',{body:{accion:tag}});
  expect(r.status).toBe(401);
  const q=await query('SELECT id FROM auditoria WHERE accion=$1',[tag]);expect(q.rowCount).toBe(0);
 });
 test('T-23.02 token inválido no permite registrar eventos',async()=>{
  const r=await request('POST','/auditoria',{token:'jwt.invalido',body:{accion:'qa-evento-fallido'}});
  expect(r.status).toBe(401);
 });
 test('T-23.03 evento real registra autor y detalles',async()=>{
  const tag='QA_EVENTO_'+suffix();let id;
  try{
   const r=await request('POST','/auditoria',{token:await login('admin'),body:{accion:tag,detalles:'verificacion-sintetica'}});
   expect(r.status).toBe(201);id=r.json.id;
   const q=await query('SELECT a.usuario_id,a.fecha_hora,a.accion,u.nombre_usuario FROM auditoria a JOIN usuarios u ON u.id=a.usuario_id WHERE a.id=$1',[id]);
   expect(q.rowCount).toBe(1);expect(q.rows[0].nombre_usuario).toBe('qa_admin');expect(q.rows[0].accion).toContain(tag);expect(q.rows[0].fecha_hora).toBeTruthy();
  }finally{if(id) await query('DELETE FROM auditoria WHERE id=$1',[id]);}
 });
 test('T-23.04 evento sin texto de acción se rechaza como error de validación',async()=>{
  const r=await request('POST','/auditoria',{token:await login('admin'),body:{}});
  expect([400,422]).toContain(r.status);
 });
 test('T-23.05 paciente no puede consultar auditoría de todos los usuarios',async()=>{
  expect((await request('GET','/auditoria',{token:await login('paciente')})).status).toBe(403);
 });
});
