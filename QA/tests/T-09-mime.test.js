const {request,login}=require('../helpers/api');
const {createPatient,createExam,cleanPatient}=require('../helpers/fixtures');
const {record}=require('../helpers/evidence');
test('T-09 | Documento con MIME falso debe ser rechazado',async()=>{
 const p=await createPatient();let status=0;
 try{
  const eid=await createExam(p.id);
  const token=await login('medico');
  const form=new FormData();
  form.set('examen_medico_id',String(eid)); form.set('paciente_id',String(p.id));
  form.set('documento',new Blob(['NO ES UN PDF: archivo inocuo de QA'],{type:'application/pdf'}),'ejemplo.pdf');
  const r=await request('POST','/documentos',{token,form,timeoutMs:14500});status=r.status;
  record('T-09',{metodo:'POST',ruta:'/documentos',tipo_declarado:'application/pdf',contenido_real:'text/plain',http:status,esperado:'HTTP 400/415/422, rechazar contenido incompatible'});
 }finally{await cleanPatient(p.id);}
 expect([400,415,422]).toContain(status);
},17000);
