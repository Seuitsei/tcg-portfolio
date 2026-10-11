const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=require('node:http').createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]);fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(e?'':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('tcgCards',JSON.stringify([{collectionId:'keep',id:'keep',name:'Keep',buy:'12.50'}]));
  window.cameraRequests=[];window.focusRequests=[];window.frames=[];window.focusAvailable=true;window.rejectLens=false;
  const media=navigator.mediaDevices,get=media.getUserMedia.bind(media);
  media.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'lens-a',label:'Back A'},{kind:'videoinput',deviceId:'lens-b',label:'Back B'}];
  media.getUserMedia=async constraints=>{
   cameraRequests.push(constraints);
   if(rejectLens&&constraints.video.deviceId)throw new DOMException('Lens unavailable','NotFoundError');
   const actual=await get({video:{width:{ideal:1920},height:{ideal:1080}},audio:false});
   const track=actual.getVideoTracks()[0],settings=track.getSettings.bind(track);
   track.getCapabilities=()=>({focusMode:focusAvailable?['continuous','single-shot']:[]});
   track.getSettings=()=>({...settings(),focusMode:focusAvailable?'continuous':undefined});
   track.applyConstraints=async c=>{focusRequests.push(c.advanced[0].focusMode);};
   frames.push(actual);return actual;
  };
  window.Worker=class{postMessage(m){const result=m.type==='init'?{count:1,lang:'fr',sets:[]}:m.type==='analyse'?{kind:'reject',reason:'Fixture',candidates:[],ms:1}:true;setTimeout(()=>this.onmessage({data:{id:m.id,type:'result',result}}),10);}terminate(){}};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/test-photo.html');
 await page.locator('#scanNav').click();await page.locator('#start').click();
 await page.waitForFunction(()=>!document.querySelector('#cameraControls').hidden&&document.querySelector('#cameraSelect').options.length===3);
 assert(await page.locator('#capture').isVisible());
 await page.locator('#cameraControls summary').click();
 assert.match(await page.locator('#cameraState').textContent(),/1920 × 1080/);
 const bounds=await page.locator('#outline').evaluate(e=>['x','y','width','height'].map(k=>e.getAttribute(k)));
 await page.locator('#refocus').click();
 assert.deepEqual(await page.evaluate(()=>focusRequests),['continuous','continuous']);
 assert.deepEqual(await page.locator('#outline').evaluate(e=>['x','y','width','height'].map(k=>e.getAttribute(k))),bounds);
 await page.locator('#cameraSelect').selectOption('lens-b');
 await page.waitForFunction(()=>frames.length===2&&!document.querySelector('#cameraControls').hidden&&!document.querySelector('#capture').disabled);
 assert(await page.evaluate(()=>frames[0].getTracks().every(t=>t.readyState==='ended')));
 assert.deepEqual(await page.evaluate(()=>cameraRequests[1].video.deviceId),{exact:'lens-b'});
 await page.locator('#capture').click();await page.waitForFunction(()=>!document.querySelector('#again').hidden);
 await page.evaluate(()=>{focusAvailable=false;});await page.locator('#again').click();
 await page.waitForFunction(()=>frames.length===3&&!document.querySelector('#cameraControls').hidden&&!document.querySelector('#capture').disabled);
 assert(await page.locator('#refocus').isDisabled());
 assert.match(await page.locator('#cameraState').textContent(),/Autofocus non contrôlable/);
 await page.evaluate(()=>{rejectLens=true;});await page.locator('#cameraSelect').selectOption('lens-a');
 await page.waitForFunction(()=>document.querySelector('#cameraState').textContent.includes('ne peut pas être ouverte'));
 assert(await page.locator('#cameraSelect').isEnabled());
 await page.locator('#cameraSelect').selectOption('');await page.waitForFunction(()=>frames.length===4&&!document.querySelector('#cameraControls').hidden&&!document.querySelector('#capture').disabled);
 await page.locator('#stop').click();assert(await page.evaluate(()=>frames.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tcgCards'))[0].buy),'12.50');
 assert.deepEqual(errors,[]);
 console.log('PASS Chromium synthetic camera: capture visibility, resolution display, refocus, lens switching/cleanup, unavailable controls, failed lens recovery, fixed guide and collection preservation. Worker and camera controls are fixtures; no phone recognition or physical autofocus is measured.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
