// Synthetic perspective checks, not a claim about physical phone accuracy.
const assert=require('node:assert/strict'),path=require('path');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const V=require('../scanner/vision.js'),cv=require('../scanner/vendor/opencv.js');
(async()=>{
 await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=resolve;});
 const images=process.env.TCG_TEST_IMAGES;if(!images)throw Error('Set TCG_TEST_IMAGES to the reference image directory');
 for(const id of ['swsh4.5-21','swsh4-102','base1-4']){
  const {data,info}=await sharp(path.join(images,'fr-'+id+'.webp')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const source=cv.matFromArray(info.height,info.width,cv.CV_8UC4,data),card=new cv.Mat();
  cv.resize(source,card,new cv.Size(252,352),0,0,cv.INTER_AREA);
  const src=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,251,0,251,351,0,351]);
  const dst=cv.matFromArray(4,1,cv.CV_32FC2,[170,54,405,72,420,415,154,426]);
  const h=cv.getPerspectiveTransform(src,dst),scene=new cv.Mat(),large=new cv.Mat();
  cv.warpPerspective(card,scene,h,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(45,55,48,255));
  cv.resize(scene,large,new cv.Size(1600,1200),0,0,cv.INTER_LINEAR);
  const detection=V.detect(cv,scene);assert(detection,id+' has visible corners');
  const normalized=detection.points.map(p=>({x:p.x/scene.cols,y:p.y/scene.rows}));
  const reuse=V.capturePoints(normalized,large.cols,large.rows);assert(reuse);
  const crop=V.warp(cv,large,reuse),ref=V.features(cv,card),query=V.features(cv,crop);
  const evidence=V.verify(cv,query,ref);
  assert(evidence.inliers>=24,id+' retains geometric correspondence');
  assert(evidence.coverage>=.22,id+' retains distributed matches');
  assert(V.vectorDistance(V.descriptor(cv,crop),V.descriptor(cv,card))<.42,id+' retains visual resemblance');
  V.dispose(source,card,src,dst,h,scene,large,crop);
  console.log('PASS captured corners at full resolution:',id,evidence.inliers,'matches');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
