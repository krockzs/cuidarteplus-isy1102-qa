const {request,login}=require('../helpers/api');
const {record}=require('../helpers/evidence');
test('T-07 | El listado de pacientes debe responder en 2 segundos o menos',async()=>{
 const token=await login('admin');
 const r=await request('GET','/pacientes',{token,timeoutMs:14000});
 record('T-07',{metodo:'GET',ruta:'/pacientes',http:r.status,tiempo_observado_ms:r.elapsedMs,maximo_aceptado_ms:2000,esperado:'HTTP 200 y tiempo <= 2000 ms'});
 expect(r.status).toBe(200);expect(r.elapsedMs).toBeLessThanOrEqual(2000);
},17000);
