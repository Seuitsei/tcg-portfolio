const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=require('node:http').createServer((req,res)=>{const f=path.join(root,req.url.split('?')[0]);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/test-localisation.html');
 await page.evaluate(async()=>{window.prices=await import('./scanner/prices.js');document.querySelector('#selection').hidden=false;window.load=prices.createPricePanel(document.querySelector('#priceContent'));});
 let requests=0;await page.route('https://api.tcgdex.net/**',async route=>{requests++;const p=new URL(route.request().url()).pathname.split('/');const f=path.join(__dirname,'fixtures','prices-'+p[2]+'-'+p[4]+'.json');if(fs.existsSync(f))await route.fulfill({path:f,contentType:'application/json'});else await route.fulfill({status:404,body:'{}'});});
 await page.evaluate(()=>load({id:'swsh4.5-21'},'fr'));let text=await page.locator('#priceContent').innerText();assert(text.includes('6,45'));assert(text.includes('3,83'));assert(text.includes('pas une cote de la carte française'));
 await page.evaluate(()=>load({id:'swsh4.5-21'},'fr'));assert.equal(requests,1);
 await page.evaluate(()=>load({id:'base1-4'},'fr'));assert(!(await page.locator('#priceContent').innerText()).includes('569,73'));await page.selectOption('#priceVariant','0');assert((await page.locator('#priceContent').innerText()).includes('569,73'));
 await page.selectOption('#priceVariant','3');text=await page.locator('#priceContent').innerText();assert(text.includes('Prix indisponible'));assert(!text.includes('569,73'));
 await page.evaluate(()=>load({id:'cel25cc-CC002'},'fr'));text=await page.locator('#priceContent').innerText();assert(text.includes('213,52'));assert(text.includes('Prix indisponible'));assert(!text.includes('0,00'));
 await page.evaluate(()=>load({id:'swsh4.5-21'},'en'));assert(!(await page.locator('#priceContent').innerText()).includes('pas une cote de la carte française'));
 await page.evaluate(()=>load({id:'missing'},'fr'));await page.getByRole('button',{name:'Réessayer les prix'}).waitFor();
 // Late responses may never replace the next selected card.
 await page.evaluate(async()=>{const native=window.fetch;window.fetch=async url=>{await new Promise(r=>setTimeout(r,url.includes('swsh4-102')?100:5));return {ok:true,json:async()=>({id:url.split('/').pop(),pricing:{cardmarket:{trend:url.includes('swsh4-102')?999:2}}})}};await Promise.all([load({id:'swsh4-102'},'en'),load({id:'other'},'en')]);window.fetch=native;});assert(!(await page.locator('#priceContent').innerText()).includes('999'));
 assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS: EUR/USD, language labels, cache, edition selection, missing variant, missing market, zero unavailable, retry, stale response, mobile width.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
