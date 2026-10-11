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
function capabilities(track){try{return track?.getCapabilities?.()||{};}catch{return {};}}
export function focusModes(track){const modes=capabilities(track).focusMode;return Array.isArray(modes)?modes:[];}
async function control(track,key,mode){
 try{await track.applyConstraints({advanced:[{[key]:mode}]});return true;}catch{return false;}
}
export async function configureFocus(track){
 const modes=focusModes(track);
 for(const mode of ['continuous','single-shot'])if(modes.includes(mode)&&await control(track,'focusMode',mode))return mode;
 return false;
}
export async function refocusCamera(track){
 const modes=focusModes(track);
 // Preserve continuous autofocus when available, including after a manual request.
 for(const mode of ['continuous','single-shot'])if(modes.includes(mode)&&await control(track,'focusMode',mode))return mode;
 return false;
}
export async function configureCamera(track,isCurrent=()=>true){
 const applied={};
 if(!isCurrent())return applied;
 applied.focusMode=await configureFocus(track);
 // Each control is independent: exposure failure must not undo autofocus.
 for(const key of ['exposureMode','whiteBalanceMode']){
  if(!isCurrent())break;
  const modes=capabilities(track)[key];
  applied[key]=Array.isArray(modes)&&modes.includes('continuous')?await control(track,key,'continuous'):false;
 }
 return applied;
}
export function cameraConstraints(deviceId=''){
 const video={width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30},focusMode:{ideal:'continuous'}};
 if(deviceId)video.deviceId={exact:deviceId};else video.facingMode={ideal:'environment'};
 return {video,audio:false};
}
export function cameraInfo(track){
 const s=track?.getSettings?.()||{},caps=capabilities(track);
 return {label:track?.label||'',width:s.width,height:s.height,frameRate:s.frameRate,facingMode:s.facingMode,focusMode:s.focusMode,exposureMode:s.exposureMode,whiteBalanceMode:s.whiteBalanceMode,zoom:s.zoom,focusDistance:s.focusDistance,availableFocusModes:focusModes(track),zoomRange:caps.zoom?{min:caps.zoom.min,max:caps.zoom.max}:null};
}
