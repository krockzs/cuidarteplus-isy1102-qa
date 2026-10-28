const {login,request}=require('../helpers/api');
const {query}=require('../helpers/db');
const {createPatient,createExam,cleanPatient}=require('../helpers/fixtures');
const {record}=require('../helpers/evidence');
test('T-03 | No debe destruir historial clínico al eliminar paciente',async()=>{
 const p=await createPatient(); let http=0, pacientePreservado=false, examenPreservado=false;
 try {
  await createExam(p.id);
  const token=await login('admin');
  const r=await request('DELETE',`/pacientes/${p.id}`,{token}); http=r.status;
  const pr=await query('SELECT COUNT(*)::int n FROM pacientes WHERE id=$1',[p.id]);
  const er=await query('SELECT COUNT(*)::int n FROM examen_medico WHERE paciente_id=$1',[p.id]);
  pacientePreservado=pr.rows[0].n>0; examenPreservado=er.rows[0].n>0;
  record('T-03',{metodo:'DELETE',ruta:'/pacientes/:id',http,paciente_preservado:pacientePreservado,examen_preservado:examenPreservado,esperado:'La operación no destruye el examen clínico asociado'});
 }finally{await cleanPatient(p.id);}
 expect(examenPreservado).toBe(true);
});
