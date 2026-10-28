const BASE = process.env.QA_API_URL || 'http://127.0.0.1:4444';
async function request(method, path, {token, body, form, timeoutMs = 15000} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const started = performance.now();
  const res = await fetch(BASE + path, {
    method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const elapsedMs = Math.round(performance.now() - started);
  const raw = await res.text();
  let json; try { json = JSON.parse(raw); } catch { json = null; }
  return {status: res.status, elapsedMs, json};
}
async function login(role) {
  const users = {admin:['qa_admin','demo_admin_qa'], medico:['qa_medico','demo_medico_qa'], paciente:['qa_paciente','demo_paciente_qa']};
  const pair = users[role];
  if (!pair) throw Error('Rol de laboratorio desconocido');
  const r = await request('POST','/autenticacion/login',{body:{nombre_usuario:pair[0],password:pair[1]}});
  if (r.status !== 200 || !r.json?.token) throw Error('Login de laboratorio falló para ' + role + ': HTTP ' + r.status);
  return r.json.token;
}
module.exports = {request, login};
