const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {createPatient,cleanPatient}=require('../helpers/fixtures');
const {record}=require('../helpers/evidence');
test('T-04 | Una edición real genera auditoría atribuible y con fecha',async()=>{
 const p=await createPatient();let status=0,tracked=false,dated=false,actor=false,updateApplied=false;
 try{
  const token=await login('admin');
  const r=await request('PUT',`/pacientes/${p.id}`,{token,body:{telefono:'111111111'}});status=r.status;
  const v=await query('SELECT telefono FROM pacientes WHERE id=$1',[p.id]);updateApplied=v.rows[0]?.telefono==='111111111';
  const a=await query(`SELECT a.usuario_id, a.fecha_hora FROM auditoria a
    WHERE a.accion=$1 ORDER BY a.id DESC LIMIT 1`,[`PACIENTES_ACTUALIZAR: actualizó paciente ID ${p.id}`]);
  tracked=a.rowCount>0; dated=!!a.rows[0]?.fecha_hora;
  const u=await query("SELECT id FROM usuarios WHERE nombre_usuario='qa_admin'");
  actor=tracked && String(a.rows[0].usuario_id)===String(u.rows[0].id);
  record('T-04',{metodo:'PUT',ruta:'/pacientes/:id',http:status,edicion_real_confirmada:updateApplied,evento_en_auditoria:tracked,usuario_correcto:actor,fecha_registrada:dated,esperado:'200, cambio persistido y evento verificable'});
 }finally{await cleanPatient(p.id);}
 expect(status).toBe(200);expect(updateApplied).toBe(true);expect(tracked).toBe(true);expect(actor).toBe(true);expect(dated).toBe(true);
});
