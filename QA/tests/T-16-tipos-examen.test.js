const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');

describe('T-16 | Catálogo de tipos de examen',()=>{
 test('T-16.01 lista de tipos de examen es consistente con BD',async()=>{
  const r=await request('GET','/tipo-examen');
  expect(r.status).toBe(200);expect(Array.isArray(r.json)).toBe(true);
  expect(r.json.length).toBeGreaterThanOrEqual(1);
  const db=await query('SELECT COUNT(*)::int n FROM tipo_examen_medico');
  expect(r.json.length).toBe(db.rows[0].n);
 });
 test('T-16.02 consulta tipo existente',async()=>{
  const db=await query('SELECT id,nombre FROM tipo_examen_medico ORDER BY id LIMIT 1');
  const r=await request('GET',`/tipo-examen/${db.rows[0].id}`,{token:await login('admin')});
  expect(r.status).toBe(200);expect(r.json.nombre).toBe(db.rows[0].nombre);
 });
 test('T-16.03 tipo inexistente devuelve 404',async()=>{
  const r=await request('GET','/tipo-examen/987654321');expect(r.status).toBe(404);
 });
});
