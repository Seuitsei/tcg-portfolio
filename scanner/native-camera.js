import {Capacitor,registerPlugin} from './capacitor-core.js';

const plugin=registerPlugin('CardCamera');
let current=null,epoch=0;
function bounds(){
 const stage=document.getElementById('stage').getBoundingClientRect(),pane=document.getElementById('appScroll').getBoundingClientRect();
 return {x:stage.x,y:stage.y,width:stage.width,height:stage.height,viewportWidth:window.innerWidth,clipTop:pane.top,clipBottom:pane.bottom};
}
async function stop(){
 const session=current;current=null;epoch++;
 if(session){session.active=false;session.observer?.disconnect();document.getElementById('appScroll').removeEventListener('scroll',session.update);window.removeEventListener('resize',session.update);cancelAnimationFrame(session.raf);}
 const stopped=plugin.stop();
 await Promise.all([stopped,...(session?.listeners||[]).map(l=>l.remove())]);
}
async function start(deviceId,onFrame,onPaused,onFocus,onTrace=()=>{}){
 const cleanup=stop(),requested=epoch;await cleanup;
 if(epoch!==requested)throw Error('Ouverture caméra interrompue.');
 const session={active:true,listeners:[],raf:0};current=session;
 const listen=async(event,fn)=>{const listener=await plugin.addListener(event,data=>{if(current===session&&session.active)fn(data);});if(current!==session){await listener.remove();throw Error('Ouverture caméra interrompue.');}session.listeners.push(listener);};
 try{
  await listen('frame',onFrame);await listen('paused',onPaused);await listen('focus',onFocus);await listen('cameraTrace',onTrace);
  if(plugin.clock){
   const sent=performance.now(),clock=await plugin.clock(),received=performance.now();
   if(current!==session)throw Error('Ouverture caméra interrompue.');
   onTrace({phase:'clock_alignment',jsSentMs:sent,jsReceivedMs:received,nativeAtMs:clock.nativeAtMs,nativeMinusJsEstimateMs:clock.nativeAtMs-(sent+received)/2,uncertaintyMs:(received-sent)/2});
  }
  const info=await plugin.start({...bounds(),deviceId});
  if(current!==session)throw Error('Ouverture caméra interrompue.');
  session.update=()=>{if(session.raf)return;session.raf=requestAnimationFrame(()=>{session.raf=0;if(current===session)plugin.setBounds(bounds()).catch(()=>{});});};
  session.observer=new ResizeObserver(session.update);session.observer.observe(document.getElementById('stage'));
  document.getElementById('appScroll').addEventListener('scroll',session.update,{passive:true});window.addEventListener('resize',session.update);
  session.update();return info;
 }catch(error){if(current===session)await stop();throw error;}
}
export function nativeGuideImage(image,guide){
 if(!guide)return image;
 const x=Math.max(0,Math.round(guide.x*image.width)),y=Math.max(0,Math.round(guide.y*image.height));
 const width=Math.min(image.width-x,Math.round(guide.width*image.width)),height=Math.min(image.height-y,Math.round(guide.height*image.height));
 if(!(width>0&&height>0))throw Error('Cadre natif invalide.');
 const data=new Uint8ClampedArray(width*height*4);
 for(let row=0;row<height;row++){const offset=((y+row)*image.width+x)*4;data.set(image.data.subarray(offset,offset+width*4),row*width*4);}
 return {data,width,height};
}
export async function decodeNativePhoto({jpeg,path},onTrace=()=>{},targetCanvas=null){
 let blob;const started=performance.now();
 if(path){
  const response=await fetch(Capacitor.convertFileSrc(path));if(!response.ok)throw Error('Lecture du JPEG local impossible ('+response.status+').');blob=await response.blob();
 }else{
  const binary=atob(jpeg),bytes=new Uint8Array(binary.length);for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);blob=new Blob([bytes],{type:'image/jpeg'});
 }
 onTrace('photo_bytes_ready',{durationMs:performance.now()-started,bytes:blob.size,transport:path?'original_jpeg_file':'base64'});
 const decoding=performance.now(),bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});
 onTrace('photo_bitmap_ready',{durationMs:performance.now()-decoding,width:bitmap.width,height:bitmap.height});
 try{
  const canvas=targetCanvas||document.createElement('canvas'),scale=path?Math.min(1,2560/Math.max(bitmap.width,bitmap.height)):1;
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const reading=performance.now(),context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=context.getImageData(0,0,canvas.width,canvas.height);onTrace('photo_pixels_ready',{durationMs:performance.now()-reading,width:image.width,height:image.height});return image;
 }finally{bitmap.close();}
}
export const nativeCamera=Capacitor.getPlatform()==='android'?{
 get active(){return !!current?.active;},start,stop,
 capture:options=>plugin.capture(options),focus:()=>plugin.focus(),
 release:photo=>photo?.photoToken?Promise.resolve(plugin.releasePhoto({photoToken:photo.photoToken})):Promise.resolve(),
 shareDiagnostic:payload=>plugin.shareDiagnostic(payload),
 preview:paused=>Promise.resolve(plugin.setPreviewPaused?.({paused})).catch(()=>{}),
 hidePreview:()=>Promise.resolve(plugin.hidePreview?.()),
 quality:q=>plugin.setQuality({progress:q.progress,hint:q.hint}).catch(()=>{}),
}:null;
