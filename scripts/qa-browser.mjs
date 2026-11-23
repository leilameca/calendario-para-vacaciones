import {createApp} from '../server.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const {chromium}=await import(process.env.QA_PLAYWRIGHT_PATH?pathToFileURL(process.env.QA_PLAYWRIGHT_PATH).href:'playwright');
const results=resolve('test-results');await mkdir(results,{recursive:true});
const dataDir=await mkdtemp(join(results,'browser-'));
const {server,engine}=await createApp({dataDir,now:()=>new Date('2026-11-18T15:00:00Z')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM?{executablePath:process.env.QA_CHROMIUM}:{})});
const errors=[];const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',err=>errors.push(err.message));
try{
  await page.goto(origin+'/c/'+engine.initialLinks.publicToken);await page.getByRole('heading',{name:'El mejor plan: contar juntos.'}).waitFor();
  await page.screenshot({path:join(results,'calendario-desktop.png'),fullPage:true});
  for(const width of [360,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'Scroll horizontal a '+width);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(results,'calendario-movil.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(origin+'/admin/#'+engine.initialLinks.adminToken);await page.getByRole('heading',{name:'Que todo esté a punto.'}).waitFor();assert.equal(new URL(page.url()).hash,'');
  await page.getByRole('button',{name:'Compañeros',exact:true}).click();
  for(const name of ['Ana','Luis']){await page.getByRole('button',{name:'Añadir compañero',exact:true}).click();await page.getByLabel('Nombre visible').fill(name);await page.getByRole('button',{name:'Guardar compañero'}).click();await page.locator('dialog').waitFor({state:'hidden'});await page.getByText(name,{exact:true}).waitFor();}
  await page.getByRole('button',{name:'Fechas',exact:true}).click();await page.getByLabel('Nombre del calendario').fill('Navidad en la oficina');await page.getByRole('button',{name:'Revisar cambios'}).click();await page.getByRole('button',{name:'Seguir editando'}).click();assert.equal(await page.getByLabel('Nombre del calendario').inputValue(),'Navidad en la oficina');await page.getByRole('button',{name:'Revisar cambios'}).click();await page.getByRole('button',{name:'Guardar fechas',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});await page.getByLabel('Nombre del calendario').waitFor();assert.equal(await page.getByLabel('Nombre del calendario').inputValue(),'Navidad en la oficina');
  await page.getByRole('button',{name:'Calendario',exact:true}).click();await page.getByRole('button',{name:'Descubrir el turno'}).click();await page.getByRole('button',{name:/Soy .+, voy a tachar/}).waitFor();await page.getByRole('button',{name:/Soy .+, voy a tachar/}).click();await page.getByRole('button',{name:'Sí, tachar hoy'}).click();await page.locator('dialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:/lo tachó/}).waitFor();
  await page.screenshot({path:join(results,'calendario-completado.png'),fullPage:true});
  await page.getByRole('button',{name:'Nuestro árbol',exact:true}).click();await page.getByRole('heading',{name:'1 de 27 adornos'}).waitFor();
  const second=await browser.newContext({viewport:{width:390,height:844}}),other=await second.newPage();other.on('pageerror',err=>errors.push(err.message));await other.goto(origin+'/c/'+engine.initialLinks.publicToken);await other.getByRole('heading',{name:/lo tachó/}).waitFor();assert.equal(await other.getByRole('button',{name:'Administración',exact:true}).count(),0);
  await other.getByRole('button',{name:'Reaccionar 👏: 0'}).click();await other.getByRole('button',{name:'Reaccionar 👏: 1'}).waitFor();
  await second.setOffline(true);await other.getByText('Sin conexión. Te mostramos el último estado; vuelve a conectarte para participar.').waitFor();assert.ok(await other.getByRole('button',{name:/Reaccionar/}).first().isDisabled());await second.setOffline(false);await other.getByText('Sin conexión. Te mostramos el último estado; vuelve a conectarte para participar.').waitFor({state:'hidden'});assert.equal(await other.getByRole('button',{name:/Reaccionar/}).first().isDisabled(),false);
  await page.getByRole('button',{name:'Administración',exact:true}).click();await page.getByRole('button',{name:'Compañeros',exact:true}).click();await page.getByRole('button',{name:'Editar',exact:true}).first().click();const png=await sharp({create:{width:300,height:500,channels:3,background:'#24634e'}}).png().toBuffer();await page.getByLabel('Fotografía (opcional)',{exact:true}).setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});await page.getByLabel('Tengo permiso para usar esta foto en el calendario del equipo.').check();await page.getByRole('button',{name:'Guardar compañero'}).click();await page.locator('dialog').waitFor({state:'hidden'});await page.locator('.person-row img').first().waitFor();await page.waitForFunction(()=>{const img=document.querySelector('.person-row img');return img&&img.complete&&img.naturalWidth>0;});
  await second.close();assert.deepEqual(errors,[]);await writeFile(join(results,'browser-qa.json'),JSON.stringify({ok:true,widths:[360,390,768,1024,1440,1920],checks:['No horizontal overflow','Admin token cleared','Create participants','Date review preserves edits','Draw and mark','Collective tree','Second browser sees shared state','Reactions','Offline and reconnect','Photo upload'],errors},null,2));console.log('QA de navegador aprobada: 6 anchos, flujos completos, dos sesiones y sin errores JavaScript.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
