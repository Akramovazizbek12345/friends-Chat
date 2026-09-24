const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'friendspace-data.json');
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.RENDER ? false : undefined, max: 5 }) : null;
let db;

function emptyDB(){ return { users: [], groups: [], group_members: [], messages: [], counters: { users: 0, groups: 0, messages: 0 } }; }
function loadFileDB(){ try { return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch { return emptyDB(); } }
function normalizeDB(x){ x ||= emptyDB(); x.users ||= []; x.groups ||= []; x.group_members ||= []; x.messages ||= []; x.counters ||= {users:0,groups:0,messages:0}; return x; }
async function loadDB(){
  if(!pool) return normalizeDB(loadFileDB());
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (id integer PRIMARY KEY, data jsonb NOT NULL)`);
  const r = await pool.query('SELECT data FROM app_state WHERE id=1');
  return r.rows[0] ? normalizeDB(r.rows[0].data) : emptyDB();
}
async function saveDB(){
  if(pool) await pool.query(`INSERT INTO app_state(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`, [JSON.stringify(db)]);
  else fs.writeFileSync(DATA_FILE, JSON.stringify(db,null,2));
}
function nextId(type){ db.counters[type]=(db.counters[type]||0)+1; return db.counters[type]; }
function safe(u){ return u && {id:u.id,username:u.username,display_name:u.display_name,avatar:u.avatar,is_admin:!!u.is_admin}; }
function userById(id){ return db.users.find(u=>u.id===Number(id)); }
function auth(req,res,next){ if(!req.session.user) return res.status(401).json({error:'Login required'}); next(); }
function admin(req,res,next){ if(!req.session.user) return res.status(401).json({error:'Login required'}); const u=userById(req.session.user.id); if(!u?.is_admin) return res.status(403).json({error:'Faqat admin uchun'}); next(); }
function member(gid,uid){ return db.group_members.some(x=>x.group_id===Number(gid)&&x.user_id===Number(uid)); }
function safeUserFields(u){ return u ? {display_name:u.display_name,avatar:u.avatar} : {display_name:'Unknown',avatar:'?'}; }

async function ensureSeed(){
  if(!db.users.length){
    const adminHash=bcrypt.hashSync('badbro123',10), friendHash=bcrypt.hashSync('demo123',10);
    [['badbro','Badbro',true,adminHash],['sardor','Sardor',false,friendHash],['madina','Madina',false,friendHash],['javohir','Javohir',false,friendHash]].forEach(([username,display_name,is_admin,password])=>db.users.push({id:nextId('users'),username,password,display_name,avatar:display_name[0],is_admin}));
    await saveDB();
  } else {
    let changed=false;
    db.users.forEach(u=>{if(typeof u.is_admin!=='boolean'){u.is_admin=u.username==='aziz';changed=true;}});
    let owner=db.users.find(u=>u.is_admin)||db.users.find(u=>u.username==='badbro')||db.users.find(u=>u.username==='aziz')||db.users[0];
    if(owner){
      if(owner.username!=='badbro'){
        const conflict=db.users.find(u=>u.username==='badbro'&&u.id!==owner.id);
        if(conflict){db.users=db.users.filter(u=>u.id!==conflict.id);db.group_members=db.group_members.filter(x=>x.user_id!==conflict.id);db.messages=db.messages.filter(m=>m.sender_id!==conflict.id&&m.receiver_id!==conflict.id);changed=true;}
        owner.username='badbro'; changed=true;
      }
      // Keep the requested initial admin credentials on migrated installations.
      if(process.env.FORCE_DEFAULT_ADMIN==='true' || !owner.password){owner.password=bcrypt.hashSync('badbro123',10);changed=true;}
      owner.display_name='Badbro'; owner.avatar='B'; owner.is_admin=true;
      db.users.filter(u=>u.id!==owner.id).forEach(u=>{if(u.is_admin){u.is_admin=false;changed=true;}});
    }
    if(changed) await saveDB();
  }
}

app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));
const sessionOptions={secret:process.env.SESSION_SECRET||'change-this-session-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:!!process.env.RENDER,maxAge:1000*60*60*24*30}};
if(pool) sessionOptions.store=new connectPgSimple({pool,createTableIfMissing:true,tableName:'user_sessions'});
app.use(session(sessionOptions));
app.use(express.static(__dirname));

app.get('/health',(req,res)=>res.json({ok:true,service:'FRIENDSPACE',database:!!pool}));
app.post('/api/login',(req,res)=>{const {username,password}=req.body||{};const u=db.users.find(x=>x.username===String(username||'').trim().toLowerCase());if(!u||!bcrypt.compareSync(password||'',u.password))return res.status(401).json({error:'Username yoki parol noto‘g‘ri'});req.session.user=safe(u);res.json({user:safe(u)});});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({user:req.session.user?safe(userById(req.session.user.id)):null}));
app.get('/api/friends',auth,(req,res)=>res.json(db.users.filter(u=>u.id!==req.session.user.id).map(safe).sort((a,b)=>a.display_name.localeCompare(b.display_name))));

app.get('/api/admin/users',admin,(req,res)=>res.json(db.users.map(u=>({id:u.id,username:u.username,display_name:u.display_name,avatar:u.avatar,is_admin:!!u.is_admin})).sort((a,b)=>a.id-b.id)));
app.post('/api/admin/users',admin,async(req,res)=>{const username=String(req.body.username||'').trim().toLowerCase(),display_name=String(req.body.display_name||'').trim(),password=String(req.body.password||'');if(!/^[a-z0-9_.-]{3,30}$/.test(username))return res.status(400).json({error:'Username 3-30 ta belgi: a-z, 0-9, _, ., -'});if(!display_name)return res.status(400).json({error:'Ism kiriting'});if(password.length<6)return res.status(400).json({error:'Parol kamida 6 ta belgidan iborat bo‘lsin'});if(db.users.some(u=>u.username.toLowerCase()===username))return res.status(409).json({error:'Bu username band'});const u={id:nextId('users'),username,password:bcrypt.hashSync(password,10),display_name,avatar:display_name[0].toUpperCase(),is_admin:false};db.users.push(u);await saveDB();res.json({user:safe(u)});});
app.delete('/api/admin/users/:id',admin,async(req,res)=>{const id=Number(req.params.id),target=userById(id);if(!target)return res.status(404).json({error:'Foydalanuvchi topilmadi'});if(target.id===req.session.user.id)return res.status(400).json({error:'O‘zingizni admin paneldan o‘chira olmaysiz'});if(target.is_admin)return res.status(400).json({error:'Boshqa adminni o‘chirish mumkin emas'});const removedGroups=new Set(db.groups.filter(g=>g.creator_id===id).map(g=>g.id));db.users=db.users.filter(u=>u.id!==id);db.group_members=db.group_members.filter(x=>x.user_id!==id&&!removedGroups.has(x.group_id));db.messages=db.messages.filter(m=>m.sender_id!==id&&m.receiver_id!==id&&!removedGroups.has(m.group_id));db.groups=db.groups.filter(g=>!removedGroups.has(g.id));await saveDB();res.json({ok:true});});
app.post('/api/admin/users/:id/password',admin,async(req,res)=>{const target=userById(req.params.id),password=String(req.body.password||'');if(!target)return res.status(404).json({error:'Foydalanuvchi topilmadi'});if(password.length<6)return res.status(400).json({error:'Parol kamida 6 ta belgi'});target.password=bcrypt.hashSync(password,10);await saveDB();res.json({ok:true});});
app.post('/api/admin/password',admin,async(req,res)=>{const currentPassword=String(req.body.currentPassword||''),newPassword=String(req.body.newPassword||''),target=userById(req.session.user.id);if(!target||!bcrypt.compareSync(currentPassword,target.password))return res.status(400).json({error:'Joriy admin paroli noto‘g‘ri'});if(newPassword.length<6)return res.status(400).json({error:'Yangi parol kamida 6 ta belgi'});target.password=bcrypt.hashSync(newPassword,10);await saveDB();res.json({ok:true});});
app.get('/api/admin/groups',admin,(req,res)=>res.json(db.groups.map(g=>({...g,members:db.group_members.filter(x=>x.group_id===g.id).length,creator:userById(g.creator_id)?.display_name||'Unknown'})).sort((a,b)=>b.id-a.id)));
app.delete('/api/admin/groups/:id',admin,async(req,res)=>{const id=Number(req.params.id);if(!db.groups.some(g=>g.id===id))return res.status(404).json({error:'Guruh topilmadi'});db.groups=db.groups.filter(g=>g.id!==id);db.group_members=db.group_members.filter(x=>x.group_id!==id);db.messages=db.messages.filter(m=>m.group_id!==id);await saveDB();io.emit('group_deleted',id);res.json({ok:true});});

app.get('/api/messages/:id',auth,(req,res)=>{const other=Number(req.params.id),me=req.session.user.id;const rows=db.messages.filter(m=>!m.group_id&&((m.sender_id===me&&m.receiver_id===other)||(m.sender_id===other&&m.receiver_id===me))).slice(-200);res.json(rows.map(m=>({...m,...safeUserFields(userById(m.sender_id))})));});
app.post('/api/messages',auth,async(req,res)=>{const receiver_id=Number(req.body.receiver_id),text=String(req.body.text||'').trim();if(!userById(receiver_id))return res.status(404).json({error:'User not found'});if(!text)return res.status(400).json({error:'Empty'});const msg={id:nextId('messages'),sender_id:req.session.user.id,receiver_id,text,created_at:new Date().toISOString()};db.messages.push(msg);await saveDB();const out={...msg,...safeUserFields(userById(msg.sender_id))};io.to('user:'+receiver_id).emit('message',out);io.to('user:'+req.session.user.id).emit('message',out);res.json(out);});
app.get('/api/groups',auth,(req,res)=>res.json(db.groups.filter(g=>member(g.id,req.session.user.id)).map(g=>({...g,members:db.group_members.filter(x=>x.group_id===g.id).length})).sort((a,b)=>b.id-a.id)));
app.post('/api/groups',auth,async(req,res)=>{const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({error:'Name required'});const g={id:nextId('groups'),name,creator_id:req.session.user.id,created_at:new Date().toISOString()};db.groups.push(g);db.group_members.push({group_id:g.id,user_id:req.session.user.id});await saveDB();res.json({...g,members:1});});
app.post('/api/groups/:id/members',auth,async(req,res)=>{const gid=Number(req.params.id),uid=Number(req.body.user_id);if(!db.groups.some(g=>g.id===gid))return res.status(404).json({error:'Group not found'});if(!member(gid,req.session.user.id))return res.status(403).json({error:'Not a member'});if(!userById(uid))return res.status(404).json({error:'User not found'});if(!member(gid,uid)){db.group_members.push({group_id:gid,user_id:uid});await saveDB();}res.json({ok:true});});
app.get('/api/groups/:id/messages',auth,(req,res)=>{const gid=Number(req.params.id);if(!member(gid,req.session.user.id))return res.status(403).json({error:'Not a member'});res.json(db.messages.filter(m=>m.group_id===gid).slice(-300).map(m=>({...m,...safeUserFields(userById(m.sender_id))})));});
app.post('/api/groups/:id/messages',auth,async(req,res)=>{const gid=Number(req.params.id),text=String(req.body.text||'').trim();if(!member(gid,req.session.user.id))return res.status(403).json({error:'Not a member'});if(!text)return res.status(400).json({error:'Empty'});const msg={id:nextId('messages'),sender_id:req.session.user.id,group_id:gid,text,created_at:new Date().toISOString()};db.messages.push(msg);await saveDB();const out={...msg,...safeUserFields(userById(msg.sender_id))};io.to('group:'+gid).emit('group_message',out);res.json(out);});

io.on('connection',socket=>{socket.on('join',uid=>{if(userById(uid))socket.join('user:'+Number(uid));});socket.on('join_group',(gid,uid)=>{if(member(gid,uid))socket.join('group:'+Number(gid));});});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));

(async()=>{try{db=await loadDB();await ensureSeed();server.listen(PORT,HOST,()=>console.log(`FRIENDSPACE running on http://${HOST}:${PORT} | database=${!!pool}`));}catch(err){console.error(err);process.exit(1);}})();
