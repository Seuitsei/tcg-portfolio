/* Independent image pipeline. Normalised RGB-block descriptor inspired by PK Scan
 * (MIT; see THIRD_PARTY_NOTICES.md). OpenCV handles geometry and ORB verification.
 * Browser Worker and Node share this exact implementation for reproducible tests. */
(function(root){
'use strict';
const WIDTH=252,HEIGHT=352,REGIONS=[[0,0,1,1],[.07,.13,.86,.43]];
const dispose=(...xs)=>xs.forEach(x=>{if(x&&typeof x.delete==='function')x.delete()});
function normaliseNumber(value){const s=String(value||'').trim().toUpperCase().replace(/\s/g,'');if(/^[A-Z]+\d+-\d+$/.test(s))return s;return s.replace(/(^|\/)([A-Z]*)(0+)(?=\d)/g,'$1$2');}
function orderPoints(points){
 const p=points.slice().sort((a,b)=>a.y-b.y),top=p.slice(0,2).sort((a,b)=>a.x-b.x),bottom=p.slice(2).sort((a,b)=>b.x-a.x);
 return [...top,...bottom];
}
function descriptor(cv,rgba){
 const out=new Int8Array(216);let offset=0;
 for(const [x,y,w,h] of REGIONS){
  const x0=Math.round(x*rgba.cols),y0=Math.round(y*rgba.rows),x1=Math.round((x+w)*rgba.cols),y1=Math.round((y+h)*rgba.rows);
  const roi=rgba.roi(new cv.Rect(x0,y0,x1-x0,y1-y0)),small=new cv.Mat();
  try{
   cv.resize(roi,small,new cv.Size(48,48),0,0,cv.INTER_AREA);
   const blocks=new Float32Array(108),means=[0,0,0];const channels=small.channels();
   for(let gy=0;gy<6;gy++)for(let gx=0;gx<6;gx++)for(let c=0;c<3;c++){
    let sum=0;for(let yy=gy*8;yy<(gy+1)*8;yy++)for(let xx=gx*8;xx<(gx+1)*8;xx++)sum+=small.data[(yy*48+xx)*channels+c];
    const i=(gy*6+gx)*3+c;blocks[i]=sum/64;means[c]+=blocks[i]/36;
   }
   let energy=0;for(let i=0;i<108;i++){blocks[i]-=means[i%3];energy+=blocks[i]*blocks[i];}
   const rms=Math.sqrt(energy/108)+1e-6;
   for(let i=0;i<108;i++)out[offset+i]=Math.max(-127,Math.min(127,Math.round(blocks[i]/rms*31)));
   offset+=108;
  }finally{dispose(roi,small);}
 }
 return out;
}
function distance(a,b,start=0,end=216){let s=0;for(let i=start;i<end;i++)s+=Math.abs(a[i]-b[i]);return s/(end-start)/31;}
function vectorDistance(a,b){return .55*distance(a,b,0,108)+.45*distance(a,b,108,216);}
function rankVectors(queries,entries,limit=16){
 return entries.map((entry,index)=>({index,distance:Math.min(...queries.map(q=>vectorDistance(q,entry.v)))})).sort((a,b)=>a.distance-b.distance).slice(0,limit);
}
function detect(cv,source){
 const scale=Math.min(1,480/source.cols,640/source.rows),small=new cv.Mat(),gray=new cv.Mat(),blur=new cv.Mat(),edges=new cv.Mat();
 let best=null;
 try{
  cv.resize(source,small,new cv.Size(Math.round(source.cols*scale),Math.round(source.rows*scale)),0,0,cv.INTER_AREA);
  cv.cvtColor(small,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
  for(let pass=0;pass<2;pass++){
   if(pass===0)cv.Canny(blur,edges,35,110);else cv.adaptiveThreshold(blur,edges,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY,31,5);
   const contours=new cv.MatVector(),hierarchy=new cv.Mat(),kernel=cv.Mat.ones(3,3,cv.CV_8U);
   try{
    if(pass===0)cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    for(let i=0;i<contours.size();i++){
     const contour=contours.get(i),poly=new cv.Mat(),hull=new cv.Mat();
     try{
      const area=Math.abs(cv.contourArea(contour)),fraction=area/(small.cols*small.rows);
      if(fraction<.09||fraction>.93)continue;
      cv.convexHull(contour,hull,false,true);
      if(area/Math.max(1,cv.contourArea(hull))<.86)continue;
      cv.approxPolyDP(hull,poly,.02*cv.arcLength(hull,true),true);
      if(poly.rows!==4||!cv.isContourConvex(poly))continue;
      const pts=orderPoints(Array.from({length:4},(_,j)=>({x:poly.data32S[j*2],y:poly.data32S[j*2+1]})));
      if(pts.some(p=>p.x<3||p.y<3||p.x>small.cols-4||p.y>small.rows-4))continue;
      const lengths=pts.map((p,j)=>Math.hypot(p.x-pts[(j+1)%4].x,p.y-pts[(j+1)%4].y));
      const ratio=(lengths[0]+lengths[2])/(lengths[1]+lengths[3]);
      if(ratio<.48||ratio>.96||Math.max(lengths[0]/lengths[2],lengths[2]/lengths[0],lengths[1]/lengths[3],lengths[3]/lengths[1])>1.65)continue;
      let maxCos=0;for(let j=0;j<4;j++){const p=pts[j],a=pts[(j+3)%4],b=pts[(j+1)%4];maxCos=Math.max(maxCos,Math.abs(((a.x-p.x)*(b.x-p.x)+(a.y-p.y)*(b.y-p.y))/(Math.hypot(a.x-p.x,a.y-p.y)*Math.hypot(b.x-p.x,b.y-p.y))));}
      if(maxCos>.52)continue;
      const cx=pts.reduce((s,p)=>s+p.x,0)/4/small.cols,cy=pts.reduce((s,p)=>s+p.y,0)/4/small.rows;
      const score=fraction*1.7-Math.abs(Math.log(ratio/(63/88)))*.23-Math.hypot(cx-.5,cy-.5)*.2;
      if(!best||score>best.score)best={score,fraction,points:pts.map(p=>({x:p.x/scale,y:p.y/scale})),ratio};
     }finally{dispose(contour,poly,hull);}
    }
   }finally{dispose(contours,hierarchy,kernel);}
  }
  return best;
 }finally{dispose(small,gray,blur,edges);}
}
function warp(cv,source,points,scale=1){
 const width=WIDTH*scale,height=HEIGHT*scale;
 const src=cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]));
 const dst=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width-1,0,width-1,height-1,0,height-1]);
 const matrix=cv.getPerspectiveTransform(src,dst),out=new cv.Mat();
 try{cv.warpPerspective(source,out,matrix,new cv.Size(width,height),cv.INTER_LINEAR,cv.BORDER_REPLICATE);return out;}catch(e){out.delete();throw e;}finally{dispose(src,dst,matrix);}
}
function quality(cv,card){
 const gray=new cv.Mat(),lap=new cv.Mat(),mean=new cv.Mat(),std=new cv.Mat(),small=new cv.Mat();
 try{
  cv.cvtColor(card,gray,cv.COLOR_RGBA2GRAY);cv.Laplacian(gray,lap,cv.CV_64F);cv.meanStdDev(lap,mean,std);
  const sharpness=std.data64F[0]**2;cv.resize(gray,small,new cv.Size(32,44),0,0,cv.INTER_AREA);
  let brightness=0,glare=0;for(let i=0;i<card.data.length;i+=4){brightness+=(card.data[i]+card.data[i+1]+card.data[i+2])/3;if(Math.min(card.data[i],card.data[i+1],card.data[i+2])>249)glare++;}
  brightness/=card.rows*card.cols;glare/=card.rows*card.cols;
  return {sharpness,brightness,glare,sample:Array.from(small.data)};
 }finally{dispose(gray,lap,mean,std,small);}
}
// Enhanced descriptors retain detail and reduce uneven foil illumination.
// Coordinates stay in the same logical frame as existing cached descriptors.
function features(cv,card,scene=false,enhance=false){
 const gray=new cv.Mat(),resized=new cv.Mat(),kp=new cv.KeyPointVector(),desc=new cv.Mat(),mask=new cv.Mat(),orb=new cv.ORB(enhance?1600:scene?1200:350);
 let eq,clahe;
 try{
  const scale=Math.min(1,900/Math.max(card.cols,card.rows));const width=scene?Math.round(card.cols*scale):WIDTH,height=scene?Math.round(card.rows*scale):HEIGHT,factor=enhance&&!scene?2:1;
  cv.resize(card,resized,new cv.Size(width*factor,height*factor),0,0,cv.INTER_AREA);cv.cvtColor(resized,gray,cv.COLOR_RGBA2GRAY);
  if(enhance){eq=new cv.Mat();clahe=new cv.CLAHE(2,new cv.Size(8,8));clahe.apply(gray,eq);}
  orb.detectAndCompute(eq||gray,mask,kp,desc);
  return {width,height,bytes:desc.data.slice(),points:Array.from({length:kp.size()},(_,i)=>{const p=kp.get(i).pt;return {x:p.x/factor,y:p.y/factor};})};
 }finally{dispose(gray,resized,kp,desc,mask,orb,eq,clahe);}
}
function verify(cv,query,reference){
 if(query.points.length<8||reference.points.length<8)return {inliers:0,ratio:0,coverage:0};
 const a=cv.matFromArray(query.points.length,32,cv.CV_8U,query.bytes),b=cv.matFromArray(reference.points.length,32,cv.CV_8U,reference.bytes),matches=new cv.DMatchVectorVector(),matcher=new cv.BFMatcher(cv.NORM_HAMMING,false);
 let src,dst,mask,H,inverse,corners,projected;
 try{
  matcher.knnMatch(a,b,matches,2);const good=[],used=new Set();
  for(let i=0;i<matches.size();i++){
   const pair=matches.get(i);try{if(pair.size()<2)continue;const x=pair.get(0),y=pair.get(1);if(x.distance<58&&x.distance<.75*y.distance&&!used.has(x.trainIdx)){used.add(x.trainIdx);good.push(x);}}finally{pair.delete();}
  }
  if(good.length<8)return {inliers:0,ratio:0,coverage:0};
  src=cv.matFromArray(good.length,1,cv.CV_32FC2,good.flatMap(m=>[query.points[m.queryIdx].x,query.points[m.queryIdx].y]));
  dst=cv.matFromArray(good.length,1,cv.CV_32FC2,good.flatMap(m=>[reference.points[m.trainIdx].x,reference.points[m.trainIdx].y]));mask=new cv.Mat();H=cv.findHomography(src,dst,cv.RANSAC,3,mask);
  if(H.empty())return {inliers:0,ratio:0,coverage:0};
  const points=good.filter((_,i)=>mask.data[i]).map(m=>query.points[m.queryIdx]);
  const inliers=points.length;
  const refPoints=good.filter((_,i)=>mask.data[i]).map(m=>reference.points[m.trainIdx]);
  const spread=ps=>ps.length?((Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)))*(Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y)))):0;
  const referenceCoverage=spread(refPoints)/(WIDTH*HEIGHT);
  const coverage=inliers?((Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))))/(WIDTH*HEIGHT):0;
  // A homography matching a repeated text strip must not masquerade as the whole card.
  inverse=new cv.Mat();cv.invert(H,inverse);corners=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,WIDTH-1,0,WIDTH-1,HEIGHT-1,0,HEIGHT-1]);projected=new cv.Mat();cv.perspectiveTransform(corners,projected,inverse);
  const geometry=Array.from({length:4},(_,i)=>({x:projected.data32F[i*2]/(query.width||WIDTH),y:projected.data32F[i*2+1]/(query.height||HEIGHT)}));
  return {inliers,ratio:inliers/good.length,coverage,referenceCoverage,corners:geometry};
 }finally{dispose(a,b,matches,matcher,src,dst,mask,H,inverse,corners,projected);}
}
function sceneSamples(cv,source,details=false){
 const samples=[];
 for(const fraction of [1,.92,.82,.72,.62])for(const cy of [.5,.58]){
  const h=source.rows*fraction,w=Math.min(source.cols*.94,h*63/88),hh=Math.min(h,w*88/63);
  const rect={x:Math.round((source.cols-w)/2),y:Math.min(source.rows-Math.round(hh),Math.max(0,Math.round(source.rows*cy-hh/2))),width:Math.round(w),height:Math.round(hh)};
  const roi=source.roi(new cv.Rect(rect.x,rect.y,rect.width,rect.height));
  try{samples.push({rect,v:descriptor(cv,roi),features:null});}finally{roi.delete();}
 }
 if(details)for(const fraction of [.66,.70,.74,.78])for(const cx of [.44,.50]){
  const h=source.rows*fraction,w=h*63/88,x=source.cols*cx-w/2,y=source.rows*.46-h/2;
  if(x<0||y<0||x+w>source.cols||y+h>source.rows)continue;
  const rect={x:Math.round(x),y:Math.round(y),width:Math.round(w),height:Math.round(h)};
  const roi=source.roi(new cv.Rect(rect.x,rect.y,rect.width,rect.height));try{samples.push({rect,v:descriptor(cv,roi),features:null,additional:true});}finally{roi.delete();}
 }
 return samples;
}
function capturePoints(points,width,height){
 if(!Array.isArray(points)||points.length!==4||!points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return null;
 let sign=0,area=0;
 for(let i=0;i<4;i++){
  const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
  const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
  if(Math.abs(cross)<.0001||sign&&Math.sign(cross)!==sign)return null;
  sign=Math.sign(cross);area+=a.x*b.y-b.x*a.y;
 }
 if(Math.abs(area)/2<.09||Math.abs(area)/2>.93)return null;
 return points.map(p=>({x:p.x*width,y:p.y*height}));
}
class StabilityGate{
 constructor(){this.reset();}
 reset(){this.previous=null;this.since=0;this.frames=0;}
 update(detection,q,width,height,now){
  if(!detection||!q){this.reset();return {ready:false,progress:0,hint:'Présente une carte entière, sur un fond contrasté.'};}
  let hint=q.brightness<45?'Ajoute de la lumière.':q.brightness>225?'Réduis la lumière.':q.glare>.2?'Incline légèrement la carte pour éviter les reflets.':q.sharpness<55?'Image floue : recule un peu et attends la mise au point.':detection.fraction<.16?'Rapproche la carte.':'';
  const current=detection.points.map(p=>({x:p.x/width,y:p.y/height}));
  let motion=1,pixel=255;
  if(this.previous){motion=Math.max(...current.map((p,i)=>Math.hypot(p.x-this.previous.points[i].x,p.y-this.previous.points[i].y)));pixel=q.sample.reduce((s,v,i)=>s+Math.abs(v-this.previous.sample[i]),0)/q.sample.length;}
  this.previous={points:current,sample:q.sample};
  if(hint||motion>.018||pixel>12){this.since=now;this.frames=0;return {ready:false,progress:hint?0:.2,hint:hint||'Carte détectée : stabilise le téléphone.'};}
  if(!this.since)this.since=now;this.frames++;
  const clear=q.sharpness>=150&&q.glare<=.06&&q.brightness>=60&&q.brightness<=210&&detection.fraction>=.24;
  const progress=Math.min(1,(now-this.since)/(clear?650:850),this.frames/4);
  return {ready:progress>=1,progress,hint:progress>=1?'Image prête.':'Ne bouge plus…'};
 }
}
// Scores are evidence thresholds, never calibrated probabilities.
function decision(ranked,hasUnindexedVariant=false){
 const a=ranked[0],b=ranked[1];if(!a||a.inliers<8||a.coverage<.06)return 'reject';
 const margin=!b||a.evidence-b.evidence>14;
 // A colour veil may suppress the coarse score: only offer a confirmation
 // when distributed, unique geometric evidence remains strong. Never auto-accept.
 if(a.distance>.82)return a.inliers>=24&&a.ratio>=.7&&a.coverage>=.25&&a.referenceCoverage>=.25&&margin?'candidates':'reject';
 if(!hasUnindexedVariant&&a.inliers>=24&&a.ratio>=.65&&a.coverage>=.22&&a.distance<.42&&margin)return 'strong';
 return 'candidates';
}
root.ScannerVision={WIDTH,HEIGHT,normaliseNumber,orderPoints,descriptor,distance,vectorDistance,rankVectors,detect,warp,quality,features,verify,sceneSamples,capturePoints,StabilityGate,decision,dispose};
if(typeof module!=='undefined')module.exports=root.ScannerVision;
})(globalThis);
