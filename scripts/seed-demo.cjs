// Creates synthetic data only; refuses to overwrite an existing database.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const target = path.resolve(__dirname, '..')
const seedPassword = process.env.DEMO_PASSWORD
if (!seedPassword || seedPassword.length < 12) throw new Error('Set DEMO_PASSWORD to a password of at least 12 characters before seeding.')
if (fs.existsSync(path.join(target, '.data/academy_demo.sqlite'))) throw new Error('Database already exists. Seeding never overwrites an existing database.')
function seed() {
  const {DatabaseSync}=require('node:sqlite')
  fs.mkdirSync(path.join(target,'.data'), { recursive: true })
  const db=new DatabaseSync(path.join(target,'.data/academy_demo.sqlite'))
  for(const name of fs.readdirSync(path.join(target,'migrations')).filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(target,'migrations',name),'utf8'))
  const password=()=>{const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(seedPassword,salt,64).toString('hex')}
  function user(name,email,role,extra={}){const fields={name,email,password:password(),role,...extra};const keys=Object.keys(fields);return Number(db.prepare(`INSERT INTO users(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(fields)).lastInsertRowid)}
  const admin=user('مدير الأكاديمية','admin@academy.example','admin',{manage:1,can_teach:0})
  user('مسؤول المتابعة','manager@academy.example','teacher',{manage:1,can_teach:0,permissions:JSON.stringify(['students_manage','schedule_manage','attendance_manage','hours_view','reports_manage','backups_manage'])})
  const teachers=['أحمد محمود','محمد عبد الله','يوسف إبراهيم','مريم أحمد','سارة محمود','نور محمد'].map((name,i)=>user(name,`teacher${i+1}@academy.example`,'teacher',{can_teach:1,rate:i%2?150:120,currency:'EGP'}))
  const parents=['ولي أمر الطالب الأول','ولي أمر الطالب الثاني','ولي أمر الطالب الثالث'].map((name,i)=>user(name,`parent${i+1}@academy.example`,'parent',{can_teach:0}))
  const names=['عمر أحمد','سلمى محمد','آدم يوسف','ليان محمود','ياسين علي','مريم خالد','أنس إبراهيم','جنى حسن','عبد الرحمن سامي','فاطمة عمر','مالك ياسر','نور أحمد']
  const pages=[152,302,84,455,210,560,62,380,125,240,96,510]
  const students=names.map((name,i)=>user(name,`student${i+1}@academy.example`,'student',{subjects:JSON.stringify(['حفظ القرآن','التجويد','اللغة العربية']),pages:pages[i],parent_id:parents[i%3],can_teach:0,enrollment_status:'active'}))
  user('طالب جديد في الانتظار','pending@academy.example','student',{subjects:JSON.stringify(['حفظ القرآن']),can_teach:0,enrollment_status:'pending'})
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'})
  const day=new Date(today+'T12:00:00Z');const first=new Date(day);first.setUTCDate(day.getUTCDate()-((day.getUTCDay()+1)%7))
  const lesson=db.prepare('INSERT INTO lessons(teacher_id,student_id,subject,start,duration,status,joined,left_at,rate,currency) VALUES(?,?,?,?,?,?,?,?,?,?)')
  const log=db.prepare('INSERT INTO progress(student_id,teacher_id,lesson_id,pages,note,created) VALUES(?,?,?,?,?,?)')
  const now=Date.now()
  for(let week=-2;week<=1;week++)for(let d=0;d<6;d++)for(let slot=0;slot<6;slot++){
    const studentIndex=(d*2+slot)%students.length;const teacherIndex=slot
    const start=new Date(first);start.setUTCDate(first.getUTCDate()+week*7+d);start.setUTCHours(8+slot,0,0,0)
    const duration=slot%2?45:30;const ended=start.getTime()+duration*60000<now
    const status=ended?(studentIndex===4&&d%3===0?'absent':'attended'):'scheduled'
    const joined=ended&&status==='attended'?new Date(start.getTime()+(slot===2?120000:0)).toISOString():null
    const left=joined?new Date(start.getTime()+duration*60000).toISOString():null
    const id=Number(lesson.run(teachers[teacherIndex],students[studentIndex],['حفظ القرآن','التجويد','اللغة العربية'][d%3],start.toISOString(),duration,status,joined,left,slot%2?150:120,'EGP').lastInsertRowid)
    if(ended&&status==='attended'&&d%3===0)log.run(students[studentIndex],teachers[teacherIndex],id,Math.max(0,pages[studentIndex]-(week===-2?18:week===-1?8:0)),'تحسن واضح في الحفظ والتلاوة، مع الالتزام بالمراجعة اليومية.',left)
  }
  // Previous-month baseline supports the parent report without inventing history.
  const previous=new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth()-1,1,10))
  for(let i=0;i<students.length;i++){
    const start=new Date(previous);start.setUTCDate(previous.getUTCDate()+Math.floor(i/6));start.setUTCHours(8+i%6)
    const id=Number(lesson.run(teachers[i%6],students[i],'حفظ القرآن',start.toISOString(),45,'attended',start.toISOString(),new Date(start.getTime()+2700000).toISOString(),120,'EGP').lastInsertRowid)
    log.run(students[i],teachers[i%6],id,Math.max(0,pages[i]-35),'متابعة الحفظ خلال الشهر السابق.',new Date(start.getTime()+2700000).toISOString())
  }
  // A pending excuse illustrates the administration workflow.
  const next=db.prepare("SELECT id,teacher_id FROM lessons WHERE status='scheduled' ORDER BY start LIMIT 1").get()
  if(next)db.prepare("INSERT INTO teacher_excuses(lesson_id,teacher_id,comment,created) VALUES(?,?,?,?)").run(next.id,next.teacher_id,'اعتذار لظرف طارئ، أرجو مراجعة الطلب وتحديد معلم بديل.',new Date().toISOString())
  db.prepare("UPDATE system_settings SET value='0' WHERE key='backups_enabled'").run()
  console.log(JSON.stringify({accounts:db.prepare('SELECT COUNT(*) n FROM users').get().n,lessons:db.prepare('SELECT COUNT(*) n FROM lessons').get().n,progress:db.prepare('SELECT COUNT(*) n FROM progress').get().n}))
  db.close()
}
seed()
