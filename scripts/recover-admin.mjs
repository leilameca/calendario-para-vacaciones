import {resolve,join} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {openCalendar} from '../lib/calendar.mjs';
const dir=resolve(process.env.DATA_DIR||'.data'),app=openCalendar(join(dir,'calendar.sqlite'));
try{const out=app.mutate('rotate',{kind:'admin'});let links={};try{links=JSON.parse(await readFile(join(dir,'accesos.json'),'utf8'));}catch{}links.adminToken=out.token;await writeFile(join(dir,'accesos.json'),JSON.stringify(links,null,2),{mode:0o600});console.log('Acceso privado renovado y sesiones anteriores revocadas. Abre ABRIR_ADMIN.cmd en esta computadora.');}finally{app.close();}
