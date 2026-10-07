const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
(async()=>{
 global.document=new JSDOM('<div id="prices"></div>').window.document;
 const {createPricePanel}=await import('../scanner/prices.js');const target=document.querySelector('#prices'),load=createPricePanel(target);let requests=0;
 global.fetch=async url=>{requests++;const p=new URL(url).pathname.split('/');const f=path.join(__dirname,'fixtures','prices-'+p[2]+'-'+p[4]+'.json');return {ok:fs.existsSync(f),json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};};
 await load({id:'swsh4.5-21'},'fr');assert(target.textContent.includes('6,45'));assert(target.textContent.includes('3,83'));assert(target.textContent.includes('pas une cote de la carte française'));
 await load({id:'swsh4.5-21'},'fr');assert.equal(requests,1);
 await load({id:'base1-4'},'fr');assert(!target.textContent.includes('569,73'));const select=target.querySelector('select');select.value='0';select.onchange();assert(target.textContent.includes('569,73'));select.value='3';select.onchange();assert(target.textContent.includes('Prix indisponible'));assert(!target.textContent.includes('569,73'));
 await load({id:'cel25cc-CC002'},'fr');assert(target.textContent.includes('213,52'));assert(target.textContent.includes('Prix indisponible'));assert(!target.textContent.includes('0,00'));
 await load({id:'swsh4.5-21'},'en');assert(!target.textContent.includes('pas une cote de la carte française'));
 await load({id:'missing'},'fr');assert.equal(target.querySelector('button').textContent,'Réessayer les prix');
 global.fetch=async url=>{await new Promise(r=>setTimeout(r,url.includes('slow')?80:5));return {ok:true,json:async()=>({id:url.split('/').pop(),pricing:{cardmarket:{trend:url.includes('slow')?999:2}}})};};
 await Promise.all([load({id:'slow'},'en'),load({id:'fast'},'en')]);assert(!target.textContent.includes('999'));assert(target.textContent.includes('2,00'));
 console.log('PASS: EUR/USD, langue FR/EN, cache, sélection édition, aucune substitution de variante, prix manquants, absence de faux zéro, relance, réponse obsolète.');
})().catch(e=>{console.error(e);process.exit(1)});
