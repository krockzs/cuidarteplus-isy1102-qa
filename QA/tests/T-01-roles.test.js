const {request,login}=require('../helpers/api');
const {query}=require('../helpers/db');
const {suffix,cleanUser}=require('../helpers/fixtures');
const {record}=require('../helpers/evidence');
test('T-01 | Paciente no debe crear usuarios administradores', async()=>{
 const name='qa_ep3_'+suffix(); let status=0, actualRole=false;
 try {
  const token=await login('paciente');
  const role=await query("SELECT id FROM roles WHERE nombre='admin'");
  const res=await request('POST','/usuarios',{token,body:{nombre_usuario:name,contrasena_hash:'contraseña-sintetica-qa',correo:`${name}@qa.invalid`,rol_id:role.rows[0].id}});
  status=res.status;
  const check=await query(`SELECT COUNT(*)::int AS n FROM usuarios u JOIN usuario_roles ur ON ur.usuario_id=u.id
    JOIN roles r ON r.id=ur.rol_id WHERE u.nombre_usuario=$1 AND r.nombre='admin'`,[name]);
  actualRole=check.rows[0].n>0;
  record('T-01',{metodo:'POST',ruta:'/usuarios',rol_solicitante:'paciente',rol_solicitado:'admin',http:status,administrador_creado:actualRole,esperado:'HTTP 401/403 y sin nuevo administrador'});
 } finally {await cleanUser(name);}
 expect([401,403]).toContain(status); expect(actualRole).toBe(false);
});
