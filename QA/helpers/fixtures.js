const {randomUUID} = require('node:crypto');
const {query} = require('./db');
const suffix = () => randomUUID().replace(/-/g,'').slice(0,11);
async function createPatient() {
  const tag = suffix();
  const rut = `${Math.floor(Math.random() * 89999999) + 10000000}-${Math.floor(Math.random()*10)}`;
  const r=await query(`INSERT INTO pacientes
    (rut,primer_nombre,apellido_paterno,fecha_nacimiento,sexo,email,telefono)
    VALUES ($1,'QA','Temporal','2000-01-01','O',$2,'000000000') RETURNING id`,[rut,`qa_${tag}@qa.invalid`]);
  return {id:r.rows[0].id,rut};
}
async function createExam(patientId) {
  const r=await query(`INSERT INTO examen_medico (tipo_examen_medico_id,paciente_id,diagnosis)
    SELECT id,$1,'Examen sintético QA' FROM tipo_examen_medico ORDER BY id LIMIT 1 RETURNING id`,[patientId]);
  return r.rows[0].id;
}
async function cleanPatient(id) {await query('DELETE FROM pacientes WHERE id = $1',[id]);}
async function cleanUser(username) {await query('DELETE FROM usuarios WHERE nombre_usuario = $1',[username]);}
module.exports={suffix,createPatient,createExam,cleanPatient,cleanUser};
