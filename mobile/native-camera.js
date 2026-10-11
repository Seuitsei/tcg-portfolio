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
async function start(deviceId,onFrame,onPaused,onFocus){
 const cleanup=stop(),requested=epoch;await cleanup;
 if(epoch!==requested)throw Error('Ouverture caméra interrompue.');
 const session={active:true,listeners:[],raf:0};current=session;
 const listen=async(event,fn)=>{const listener=await plugin.addListener(event,data=>{if(current===session&&session.active)fn(data);});if(current!==session){await listener.remove();throw Error('Ouverture caméra interrompue.');}session.listeners.push(listener);};
 try{
  await listen('frame',onFrame);await listen('paused',onPaused);await listen('focus',onFocus);
  const info=await plugin.start({...bounds(),deviceId});
  if(current!==session)throw Error('Ouverture caméra interrompue.');
  session.update=()=>{if(session.raf)return;session.raf=requestAnimationFrame(()=>{session.raf=0;if(current===session)plugin.setBounds(bounds()).catch(()=>{});});};
  session.observer=new ResizeObserver(session.update);session.observer.observe(document.getElementById('stage'));
  document.getElementById('appScroll').addEventListener('scroll',session.update,{passive:true});window.addEventListener('resize',session.update);
  session.update();return info;
 }catch(error){if(current===session)await stop();throw error;}
}
export async function decodeNativePhoto({jpeg}){
 const binary=atob(jpeg),bytes=new Uint8Array(binary.length);for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);
 const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
 try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0);return context.getImageData(0,0,canvas.width,canvas.height);}finally{bitmap.close();}
}
export const nativeCamera=Capacitor.getPlatform()==='android'?{
 get active(){return !!current?.active;},start,stop,
 capture:()=>plugin.capture(),focus:()=>plugin.focus(),
 quality:q=>plugin.setQuality({progress:q.progress,hint:q.hint}).catch(()=>{}),
}:null;
