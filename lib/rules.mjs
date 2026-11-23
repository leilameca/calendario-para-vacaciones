import {randomBytes,randomInt,createHash} from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const todayIn = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year:'numeric',month:'2-digit',day:'2-digit' }).format(now);
export const addDays = (date,n) => new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function dateRange(start,end) { const a=[]; for(let d=start;d<=end;d=addDays(d,1)) { a.push(d); if(a.length>366) throw new Error('El calendario admite hasta 366 días.'); } return a; }
export const weekday = date => new Date(date+'T12:00:00Z').getUTCDay();
export const automatic = (date,c) => [0,6].includes(weekday(date)) || c.holidays.some(h=>h.date===date);
export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const assert = (v,m,status=400) => {if(!v) throw new AppError(m,status);};
export function validDate(v) { return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T12:00:00Z')) && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v; }
export function validateConfig(c) {
  assert(typeof c.title==='string' && c.title.trim().length>=2 && c.title.length<=60,'El nombre debe tener entre 2 y 60 caracteres.');
  assert(typeof c.company==='string' && c.company.length<=80,'Revisa el nombre de la empresa.');
  for(const k of ['start','lastWork','vacation','returnDate']) assert(validDate(c[k]),'Revisa las fechas.');
  assert(c.start<=c.lastWork && c.lastWork<c.vacation && c.vacation<c.returnDate,'Ordena las fechas: inicio, último día de trabajo, vacaciones y regreso.');
  dateRange(c.start,c.lastWork);
  assert(Array.isArray(c.holidays) && c.holidays.length<=100,'Revisa los feriados.');
  assert(c.holidays.every(h=>validDate(h.date) && typeof h.name==='string' && h.name.trim().length>0 && h.name.length<=80),'Cada feriado necesita una fecha y un nombre.');
  assert(new Set(c.holidays.map(h=>h.date)).size===c.holidays.length,'Hay feriados repetidos.');
  assert(!automatic(c.lastWork,c),'El último día de trabajo debe ser laborable.');
}

export function createRules(now=()=>new Date()) {
  const audit=(s,action,details)=>{s.events.push({id:token().slice(0,12),at:now().toISOString(),action,...details});};
  function reconcile(s) {
    const today=todayIn(now()); let changed=false;
    for(const date of dateRange(s.config.start,s.config.lastWork)) {
      if(date>today) break;
      if(automatic(date,s.config) && !s.days[date]) { s.days[date]={date,status:'completed',source:'system',name:'Sistema',completedAt:now().toISOString(),reactions:{}};changed=true; }
    }
    if(changed) s.version++;
  }
  function draw(s,date) {
    const old=s.days[date]; if(old?.participantId) return old;
    const people=s.participants.filter(p=>p.active);
    assert(people.length>=2,people.length?'Se necesitan al menos dos compañeros para evitar turnos consecutivos.':'Añade compañeros para empezar.');
    let eligible=people.filter(p=>!s.used.includes(p.id) && p.id!==s.lastAssigned);
    if(!eligible.length) { s.cycle++;s.used=[];eligible=people.filter(p=>p.id!==s.lastAssigned); }
    const p=eligible[randomInt(eligible.length)];s.used.push(p.id);s.lastAssigned=p.id;
    const day={date,status:'assigned',source:'human',participantId:p.id,name:p.name,photo:p.photo,cycle:s.cycle,assignedAt:now().toISOString(),reactions:{}};
    s.days[date]=day;audit(s,'Turno asignado',{date,name:p.name,cycle:s.cycle});return day;
  }
  function humanDay(s,date) {assert(date===todayIn(now()),'La fecha cambió. Actualiza el calendario.',409);assert(date>=s.config.start && date<=s.config.lastWork,'El calendario no está abierto.');assert(!automatic(date,s.config),'Este día lo marca el sistema.');assert(!s.config.paused,'La dinámica está pausada.');}
  function mutate(s,action,input={}) {
      reconcile(s);const date=input.date, before=JSON.parse(JSON.stringify(s.config));
      if(action==='draw') {humanDay(s,date);draw(s,date);}
      else if(action==='complete') {humanDay(s,date);const d=s.days[date];assert(d?.participantId,'Descubre el turno primero.');assert(d.status!=='omitted','El día fue omitido.');if(d.status!=='completed'){d.status='completed';d.completedAt=now().toISOString();audit(s,'Día completado',{date,name:d.name});}}
      else if(action==='reaction') {const d=s.days[date];assert(d?.status==='completed','Solo puedes reaccionar a días completados.');assert(['❤️','🎄','👏','🎉'].includes(input.emoji),'Reacción inválida.');assert(typeof input.browserId==='string' && /^[a-zA-Z0-9_-]{16,80}$/.test(input.browserId),'Identificador inválido.');d.reactions[hash(input.browserId)]=input.emoji;}
      else if(action==='participant') {
        const name=String(input.name||'').trim();assert(name.length>=2 && name.length<=50,'El nombre debe tener entre 2 y 50 caracteres.');
        assert(!s.participants.some(p=>p.id!==input.id && p.name.toLocaleLowerCase()===name.toLocaleLowerCase()) || input.allowDuplicate,'Ya existe ese nombre. Añade un apellido o confirma el duplicado.');
        let p=s.participants.find(p=>p.id===input.id);if(input.id) assert(p,'Compañero no encontrado.',404);
        if(!p){p={id:token().slice(0,16),name,active:true,photo:null};s.participants.push(p);}
        const original={...p};
        if(input.active===false && p.active) {const d=s.days[todayIn(now())];assert(!(d?.participantId===p.id && d.status==='assigned'),'Tiene el turno de hoy. Reasigna ese turno con un motivo antes de desactivarlo.');}
        p.name=name;p.active=input.active!==false;
        if(input.photo!==undefined) p.photo=input.photo;
        audit(s,'Compañero actualizado',{before:original,after:{...p}});
      }
      else if(action==='config') {
        assert(input.version===s.version,'Hay cambios nuevos. Actualiza antes de guardar.',409);
        const c={title:input.config?.title,company:input.config?.company,start:input.config?.start,lastWork:input.config?.lastWork,vacation:input.config?.vacation,returnDate:input.config?.returnDate,holidays:input.config?.holidays,paused:!!input.config?.paused}; validateConfig(c);
        const archived=Object.values(s.days).filter(d=>d.status==='completed' && (d.date<c.start || d.date>c.lastWork));
        assert(!archived.length || input.confirmArchive,'Confirma el archivado de los días completados fuera del rango.');
        assert(Object.values(s.days).every(d=>d.date<c.start || d.date>c.lastWork || d.source===(automatic(d.date,c)?'system':'human')),'Hay fechas con historial cuyo tipo cambiaría. Conserva su tipo o archívalas.');
        s.config=c;audit(s,'Configuración actualizada',{before,after:c,archived:archived.map(d=>d.date)});reconcile(s);
      }
      else if(action==='correction') {
        assert(typeof input.reason==='string' && input.reason.trim().length>=5 && input.reason.length<=500,'Escribe un motivo de al menos 5 caracteres.');
        assert(date<=todayIn(now()) && date>=s.config.start && date<=s.config.lastWork,'Solo se corrigen días que ya llegaron dentro del rango.');
        assert(!automatic(date,s.config),'Los días automáticos conservan la marcación del sistema.');
        const old=s.days[date]?JSON.parse(JSON.stringify(s.days[date])):null;
        if(input.operation==='undo') {assert(old?.status==='completed','Ese día no está completado.');s.days[date].status='assigned';delete s.days[date].completedAt;}
        else if(input.operation==='omit') {assert(old?.status!=='completed','Deshaz primero la marcación.');s.days[date]={...(old||{date,source:'human',reactions:{}}),status:'omitted'};}
        else if(input.operation==='complete') {assert(old?.status!=='completed','Ese día ya está completado.');if(!old?.participantId) {const p=s.participants.find(p=>p.id===input.participantId);assert(p,'Elige un compañero para atribuir el día.');s.days[date]={date,source:'human',participantId:p.id,name:p.name,photo:p.photo,reactions:{}};}s.days[date].status='completed';s.days[date].completedAt=now().toISOString();}
        else if(input.operation==='reassign') {assert(old?.status==='assigned','Solo se reasignan turnos sin completar.');const p=s.participants.find(p=>p.id===input.participantId && p.active);assert(p && p.id!==old.participantId,'Elige otro compañero activo.');const prev=Object.values(s.days).filter(d=>d.participantId && d.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0];assert(prev?.participantId!==p.id,'No se permite repetir el turno humano anterior.');s.days[date]={...old,participantId:p.id,name:p.name,photo:p.photo,assignedAt:now().toISOString()};if(date===todayIn(now())){s.lastAssigned=p.id;if(!s.used.includes(p.id))s.used.push(p.id);}}
        else throw new AppError('Corrección inválida.');
        audit(s,'Corrección: '+input.operation,{date,reason:input.reason.trim(),before:old,after:s.days[date]});
      }
      else if(action==='rotate') {assert(['public','admin'].includes(input.kind),'Acceso inválido.');const newToken=token();s[input.kind+'Hash']=hash(newToken);if(input.kind==='admin'){s.generation++;}audit(s,'Acceso renovado',{kind:input.kind});s.version++;return {token:newToken};}
      else throw new AppError('Operación desconocida.',404);
      s.version++;return {ok:true,version:s.version};
  }

return {reconcile,mutate,audit};
}
