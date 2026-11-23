import {DatabaseSync} from 'node:sqlite';
import {token,hash,createRules} from './rules.mjs';
export * from './rules.mjs';
export function openCalendar(path, {now=()=>new Date()}={}) {
  const db=new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS app (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, generation INTEGER NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, full BLOB NOT NULL, thumb BLOB NOT NULL);');
  let initialLinks=null;
  if(!db.prepare('SELECT id FROM app WHERE id=1').get()) {
    const publicToken=token(),adminToken=token();
    const s={schema:1, version:1, generation:1, publicHash:hash(publicToken), adminHash:hash(adminToken), photoSecret:token(), config:{title:'Ya casi',company:'',start:'2026-11-18',lastWork:'2026-12-14',vacation:'2026-12-15',returnDate:'2027-01-07',holidays:[],paused:false}, participants:[],days:{},cycle:1,used:[],lastAssigned:null,events:[]};
    db.prepare('INSERT INTO app VALUES(1,?)').run(JSON.stringify(s)); initialLinks={publicToken,adminToken};
  }
  const read=()=>JSON.parse(db.prepare('SELECT body FROM app WHERE id=1').get().body);
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try {const s=read();const result=fn(s);db.prepare('UPDATE app SET body=? WHERE id=1').run(JSON.stringify(s));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const {reconcile,mutate:apply,audit}=createRules(now);
  const state=()=>tx(s=>{reconcile(s);return s;});
  const mutate=(action,input={})=>tx(s=>{const result=apply(s,action,input);if(action==='rotate'&&input.kind==='admin')db.exec('DELETE FROM sessions');return result;});
  return {db,initialLinks,read,state,tx,mutate,audit,close:()=>db.close(),now};
}
