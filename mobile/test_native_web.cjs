const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.join(__dirname,'www');
 const server=require('node:http').createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]);fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(e?'':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/capacitor-core.js',route=>route.fulfill({contentType:'text/javascript',body:"export const Capacitor={getPlatform:()=> 'android'};export const registerPlugin=()=>window.nativeFixture;"}));
 await page.addInitScript(()=>{
  localStorage.setItem('tcgCards',JSON.stringify([{collectionId:'keep',id:'keep',name:'Keep',buy:'12.50'}]));
  window.nativeStarts=[];window.nativeStops=0;window.nativeFocus=0;window.nativeQualities=[];window.nativeBounds=[];window.nativeEvents={};window.captureSizes=[];window.holdNativeCapture=false;window.pendingCaptureReject=null;
  const jpeg=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').fillRect(0,0,w,h);return c.toDataURL('image/jpeg').split(',')[1];};
  window.nativeFixture={
   addListener:async(name,fn)=>{nativeEvents[name]=fn;return {remove:async()=>{if(nativeEvents[name]===fn)delete nativeEvents[name];}};},
   start:async options=>{nativeStarts.push(options);await new Promise(r=>setTimeout(r,50));return {engine:'CameraX',label:'Native test',width:1920,height:2560,devices:[{deviceId:'rear-a',label:'Rear A'},{deviceId:'rear-b',label:'Rear B'}]};},
   stop:async()=>{nativeStops++;if(pendingCaptureReject){const reject=pendingCaptureReject;pendingCaptureReject=null;reject(Error('Capture interrupted'));}},
   setBounds:async b=>{nativeBounds.push(b);},
   setQuality:async q=>{nativeQualities.push(q);},
   focus:async()=>{nativeFocus++;return {success:true};},
   capture:async()=>holdNativeCapture?new Promise((resolve,reject)=>{pendingCaptureReject=reject;}):({jpeg:jpeg(960,1280),engine:'CameraX',width:960,height:1280}),
  };
  window.sendNativeFrame=()=>nativeEvents.frame?.({jpeg:jpeg(504,704)});
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{throw Error('APK must never use WebView getUserMedia');};
  window.Worker=class{postMessage(m){if(m.type==='analyse')captureSizes.push([m.image.width,m.image.height]);const result=m.type==='init'?{count:1,lang:'fr',sets:[]}:m.type==='analyse'?{kind:'reject',reason:'Native bridge fixture',candidates:[],ms:1}:true;setTimeout(()=>this.onmessage({data:{id:m.id,type:'result',result}}),10);}terminate(){}};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.locator('#scanNav').click();await page.locator('#start').click();
 await page.waitForFunction(()=>!document.querySelector('#cameraControls').hidden);
 assert.match(await page.locator('#cameraState').textContent(),/CameraX/);
 assert(await page.locator('#capture').isVisible());
 const shutter=page.locator('#capture');
 assert.equal(await shutter.evaluate(e=>getComputedStyle(e).webkitTapHighlightColor),'rgba(0, 0, 0, 0)');
 const box=await shutter.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 const pressed=await shutter.evaluate(e=>({background:getComputedStyle(e).backgroundColor,disc:getComputedStyle(e.querySelector('.shutterDisc')).transform}));
 assert.equal(pressed.background,'rgba(0, 0, 0, 0)');assert.notEqual(pressed.disc,'none');
 await page.mouse.move(0,0);await page.mouse.up();
 const bounds=await page.locator('#outline').evaluate(e=>['x','y','width','height'].map(k=>e.getAttribute(k)));
 await page.evaluate(()=>sendNativeFrame());await page.waitForFunction(()=>nativeQualities.length>0);
 assert.deepEqual(await page.locator('#outline').evaluate(e=>['x','y','width','height'].map(k=>e.getAttribute(k))),bounds);
 await page.locator('#cameraControls summary').click();await page.locator('#refocus').click();assert.equal(await page.evaluate(()=>nativeFocus),1);
 await page.locator('#cameraSelect').selectOption('rear-b');await page.waitForFunction(()=>nativeStarts.length===2&&!document.querySelector('#cameraControls').hidden);
 assert.equal(await page.evaluate(()=>nativeStarts[1].deviceId),'rear-b');
 await page.locator('#capture').click();await page.waitForFunction(()=>!document.querySelector('#again').hidden);
 assert(await page.locator('#frozenPreview').isVisible());
 assert.deepEqual(await page.evaluate(()=>captureSizes),[[960,1280]]);
 const diagnostic=JSON.parse(await page.locator('#debug').textContent());assert.equal(diagnostic.camera.engine,'CameraX');assert.equal(diagnostic.camera.captureHeight,1280);
 await page.locator('#again').click();await page.waitForFunction(()=>nativeStarts.length===3&&!document.querySelector('#cameraControls').hidden);
 assert(await page.locator('#frozenPreview').isHidden());
 await page.evaluate(()=>nativeEvents.paused({}));await page.waitForFunction(()=>document.querySelector('#capture').hidden);
 await page.locator('#start').click();await page.waitForFunction(()=>!document.querySelector('#cameraControls').hidden);
 await page.evaluate(()=>{holdNativeCapture=true;});await page.locator('#capture').click();await page.waitForFunction(()=>pendingCaptureReject!==null);
 await page.locator('#portfolioNav').click();await page.waitForFunction(()=>!document.querySelector('#import').disabled);assert(await page.locator('#scanScreen').isHidden());
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tcgCards'))[0].buy),'12.50');
 assert(await page.evaluate(()=>nativeStops>=nativeStarts.length));
 assert.deepEqual(errors,[]);
 console.log('PASS packaged APK JS: CameraX bridge exclusively, decoded still photo to worker, quality/fixed guide, lens switch, focus, restart, pause, navigation cleanup and collection preservation. Native bridge and worker are fixtures; not physical autofocus or card accuracy.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});

