const {ensureLab,pool}=require('./db');
beforeAll(async()=>{ await ensureLab(); const res=await fetch(process.env.QA_API_URL || 'http://127.0.0.1:4444');
  if(!res.ok) throw new Error('API de QA no responde');
});
afterAll(async()=>{await pool.end();});
