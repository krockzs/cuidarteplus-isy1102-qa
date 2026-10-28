const {request}=require('../helpers/api');
const {record}=require('../helpers/evidence');
test('T-02 | Una solicitud anónima no obtiene datos clínicos por RUT',async()=>{
 const res=await request('GET','/pacientes/buscar/rut/99999999-9');
 const exposed=!!(res.json && (res.json.observaciones_medicas_generales || res.json.alergias));
 record('T-02',{metodo:'GET',ruta:'/pacientes/buscar/rut/:rut',autorizacion:false,http:res.status,campos_clinicos_expuestos:exposed,esperado:'HTTP 401/403 sin datos clínicos'});
 expect([401,403]).toContain(res.status); expect(exposed).toBe(false);
});
