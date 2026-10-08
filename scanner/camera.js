// One best full-resolution image and its matching corners per stable sequence.
export class BestFrame {
 constructor(){this.reset();}
 reset(){this.image=null;this.points=null;this.score=-Infinity;this.time=0;}
 consider(state,now,capture){
  if(!state.stableFrames||!state.quality){this.reset();return;}
  const q=state.quality,score=q.sharpness*(1-q.glare)**2;
  if(!Number.isFinite(score))return;
  if(!this.image||now-this.time>650||score>this.score){
   this.image=capture();this.points=state.points?.map(p=>({x:p.x,y:p.y}))||null;
   this.score=score;this.time=now;
  }
 }
 takeSample(now){const sample=now-this.time<=650&&this.image?{image:this.image,points:this.points}:null;this.reset();return sample;}
 take(now){return this.takeSample(now)?.image||null;}
}
export function nextDelay(start,now){return Math.max(20,150-(now-start));}
async function continuousControl(track,key){
 try{
  const caps=track.getCapabilities?.()||{};
  if(!Array.isArray(caps[key])||!caps[key].includes('continuous'))return false;
  await track.applyConstraints({advanced:[{[key]:'continuous'}]});return true;
 }catch{return false;} // Unsupported controls must never interrupt the camera.
}
export function configureFocus(track){return continuousControl(track,'focusMode');}
export async function configureCamera(track,isCurrent=()=>true){
 const applied={};
 // Separate attempts: a rejected exposure control must not undo autofocus.
 for(const key of ['focusMode','exposureMode','whiteBalanceMode']){
  if(!isCurrent())break;
  applied[key]=await continuousControl(track,key);
 }
 return applied;
}
export function cameraInfo(track){
 const s=track?.getSettings?.()||{};
 return {width:s.width,height:s.height,frameRate:s.frameRate,facingMode:s.facingMode,focusMode:s.focusMode,exposureMode:s.exposureMode,whiteBalanceMode:s.whiteBalanceMode};
}
