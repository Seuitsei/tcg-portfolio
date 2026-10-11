// Only patch the generated APK bundle. Repository web source and main are untouched.
const fs=require('node:fs'),path=require('node:path');
module.exports=function patchNativeWeb(out){
 const file=path.join(out,'scanner/photo-app.js');let app=fs.readFileSync(file,'utf8');
 function replace(before,after){if(app.split(before).length!==2)throw Error('Native integration source changed: '+before.slice(0,90));app=app.replace(before,after);}
 replace("const VERSION='20261011-camera1';", "const VERSION='20261011-camerax1';\nimport {nativeCamera,decodeNativePhoto} from './native-camera.js?v=20261011-camerax1';\nlet nativeInfo=null,nativeFrameBusy=false,nativeCaptureSerial=0;");
 replace("function stopCamera(){", "function stopCamera(){if(nativeCamera){nativeCaptureSerial++;if(!analysisBusy)$('import').disabled=false;nativeCamera.stop().catch(()=>{});nativeInfo=null;}");
 replace("function showCameraState(message=''){", `function showCameraState(message=''){
 if(nativeCamera&&nativeInfo){
  $('refocus').disabled=analysisBusy||!nativeCamera.active;
  $('cameraState').textContent=['CameraX · caméra native',nativeInfo.width&&nativeInfo.height?nativeInfo.width+' × '+nativeInfo.height+' (capture)':'', 'Touche l’aperçu pour faire le point',message].filter(Boolean).join(' · ');return;
 }
`);
 replace("async function listCameras(token){", `async function listCameras(token){
 if(nativeCamera&&nativeInfo){if(token!==cameraToken)return;const devices=nativeInfo.devices||[];$('cameraSelect').replaceChildren(new Option('Caméra arrière automatique',''),...devices.map(d=>new Option(d.label,d.deviceId)));$('cameraSelect').value=selectedCamera;$('cameraSelect').disabled=devices.length<2;return;}
`);
 replace("  if(!navigator.mediaDevices?.getUserMedia)", `  if(nativeCamera){await startNativeCamera(token);return;}
  if(!navigator.mediaDevices?.getUserMedia)`);
 replace("function schedule(){clearTimeout(timer);if(live&&!paused)", "function schedule(){clearTimeout(timer);if(live&&!paused&&!nativeCamera)");
 replace("async function analyseCamera(){", "async function analyseCamera(){if(nativeCamera){await analyseNativeCamera();return;}");
 replace("if(stream){showCameraState();listCameras(token);}", "if(stream||nativeInfo){showCameraState();listCameras(token);}if(nativeCamera&&!nativeCamera.active)$('capture').disabled=true;");
 replace("$('refocus').onclick=async()=>{", "$('refocus').onclick=async()=>{if(nativeCamera){$('refocus').disabled=true;try{const result=await nativeCamera.focus();cameraDiagnostic.focusSuccessful=result.success;focusGate.reset();drawOutline(null,0);showCameraState(result.success?'Mise au point effectuée.':'Mise au point non confirmée : éloigne un peu la carte.');}catch(e){showCameraState(e.message);}return;}");
 replace("stopCamera();const url=URL.createObjectURL(file);", "stopCamera();cameraDiagnostic={engine:'import'};const url=URL.createObjectURL(file);");
 replace("document.hidden&&(stream||$('start').disabled)", "document.hidden&&(stream||nativeCamera?.active||$('start').disabled)");
 app+=`
async function startNativeCamera(token){
 $('stage').scrollIntoView({behavior:'instant',block:'center'});
 nativeInfo=await nativeCamera.start(selectedCamera,
  async frame=>{
   if(token!==cameraToken||!live||paused||nativeFrameBusy)return;nativeFrameBusy=true;
   try{const image=await decodeNativePhoto(frame);if(token!==cameraToken||paused)return;const q=focusGate.evaluate(image,performance.now());cameraDiagnostic={...cameraDiagnostic,focus:q};drawOutline(null,q.progress);$('liveHint').textContent=q.hint;$('capture').classList.toggle('photo-ready',q.ready);nativeCamera.quality(q);}catch{if(token===cameraToken&&!paused){focusGate.reset();nativeCamera.quality({progress:0,hint:'Place la carte dans le cadre.'});}}finally{nativeFrameBusy=false;}
  },()=>{if(token===cameraToken){stopCamera();status('Caméra mise en pause. Rouvre-la pour reprendre.');}},result=>{if(token===cameraToken)cameraDiagnostic.focusSuccessful=result.success;}
 );
 if(token!==cameraToken)return;
 cameraDiagnostic={engine:'CameraX',label:nativeInfo.label,width:nativeInfo.width,height:nativeInfo.height,focusMode:'native'};
 live=true;paused=false;$('scanScreen').classList.add('camera-open');$('cameraPlaceholder').hidden=true;$('video').hidden=true;$('frozenPreview').hidden=true;$('stop').hidden=false;$('capture').hidden=false;$('capture').disabled=false;$('liveHint').hidden=false;$('meter').hidden=false;$('stage').classList.remove('idle');$('cameraControls').hidden=false;showCameraState();await listCameras(token);
 if(ready)await rpc('reset');if(token===cameraToken)status('Caméra native prête. Touche l’image pour faire le point puis appuie sur Scanner.');
}
async function analyseNativeCamera(){
 if(!ready){status('Le catalogue est encore en préparation.');return;}
 if(analysisBusy||!live||paused||!nativeCamera.active)return;
 const token=cameraToken,job=++nativeCaptureSerial;paused=true;$('capture').disabled=true;$('cameraSelect').disabled=true;$('refocus').disabled=true;$('import').disabled=true;status('Prise de la photo native…');
 try{
  const photo=await nativeCamera.capture();if(token!==cameraToken)return;
  const image=await decodeNativePhoto(photo);if(token!==cameraToken)return;
  cameraDiagnostic={...cameraDiagnostic,captureWidth:image.width,captureHeight:image.height};
  await nativeCamera.stop();if(token!==cameraToken)return;
  $('frozenPreview').width=image.width;$('frozenPreview').height=image.height;$('frozenPreview').getContext('2d').putImageData(image,0,0);$('frozenPreview').hidden=false;
  await analyseImage(image,false,null,true);
 }catch(e){if(token===cameraToken){paused=false;status(e.message,true);}}
 finally{if(job===nativeCaptureSerial)$('import').disabled=false;if(token===cameraToken){$('capture').disabled=!nativeCamera.active;if(nativeInfo){showCameraState();listCameras(token);}}}
}
`;
 fs.writeFileSync(file,app);
 fs.copyFileSync(path.join(__dirname,'native-camera.js'),path.join(out,'scanner/native-camera.js'));
 fs.copyFileSync(path.join(__dirname,'node_modules/@capacitor/core/dist/index.js'),path.join(out,'scanner/capacitor-core.js'));
 const shutterStyle=`<style id="native-shutter-feedback">
 /* Android WebView paints a rectangular tap highlight unless explicitly disabled. */
 #capture{-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none}
 #capture:active,#capture:focus{background:transparent;box-shadow:none}
 #capture:focus-visible{outline:none}
 #capture:focus-visible .shutterDisc{outline-color:#a3bcf5}
 #capture .shutterDisc{pointer-events:none}
 #capture:active .shutterDisc{transform:scale(.94);background:#e3e8ee}
 </style>`;
 for(const name of ['index.html','test-photo.html']){const p=path.join(out,name);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('20261011-camera1','20261011-camerax1').replace('</head>',shutterStyle+'\n</head>'));}
};

