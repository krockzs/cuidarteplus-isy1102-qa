const {request}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,cleanUser}=require('../helpers/fixtures');
const {record}=require('../helpers/evidence');
test('T-05 | Las contraseñas de nuevas cuentas no deben quedar en claro',async()=>{
 const name='qa_ep3_'+suffix();const plain='ContrasenaSinteticaQA!2026';let status=0,storedPlain=false;
 try{
  const r=await request('POST','/autenticacion/registro',{body:{nombre_usuario:name,password:plain,correo:`${name}@qa.invalid`}});status=r.status;
  const s=await query('SELECT (contrasena=$2) AS igual FROM usuarios WHERE nombre_usuario=$1',[name,plain]);
  storedPlain=s.rows[0]?.igual===true;
  record('T-05',{metodo:'POST',ruta:'/autenticacion/registro',http:status,contrasena_coincide_texto_claro:storedPlain,esperado:'Cuenta creada con hash irreversible, no contraseña literal'});
 } finally{await cleanUser(name);}
 expect(status).toBe(201);expect(storedPlain).toBe(false);
});
