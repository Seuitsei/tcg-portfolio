// A quality guide, never an identity check or a guarantee that OCR can read every letter.
export class FocusGate {
 constructor(){this.reset();}
 reset(){this.previous=null;this.motionPrevious=null;this.motionAnchor=null;this.lastAt=null;this.since=null;this.stableSince=null;}
 evaluate(image,now){
  const {width:w,height:h,data}=image,g=new Uint8Array(w*h);let light=0,clipped=0;
  for(let i=0;i<g.length;i++){const p=i*4;g[i]=(data[p]*77+data[p+1]*150+data[p+2]*29)>>8;light+=g[i];if(g[i]>248)clipped++;}
  // Name, rules/attacks and collector number: separate bands avoid a sharp picture
  // masking unreadable lower text. Strong-edge acutance is less contrast-dependent.
  const bands=[[.06,.05,.94,.19],[.08,.53,.92,.82],[.05,.87,.95,.98]];
  const zones=bands.map(([x0,y0,x1,y1])=>{let edges=0,crisp=0,energy=0;
   for(let y=Math.floor(h*y0)+1;y<h*y1-1;y+=2)for(let x=Math.floor(w*x0)+1;x<w*x1-1;x+=2){const i=y*w+x,dx=Math.abs(g[i+1]-g[i-1]),dy=Math.abs(g[i+w]-g[i-w]),grad=dx+dy;if(grad>32){edges++;const lap=Math.abs(4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w]);energy+=lap;if(lap>22)crisp++;}}
   return {edges,acutance:edges?energy/edges:0,crisp:edges?crisp/edges:0};});
  let motion=Infinity;if(this.previous){let sum=0,n=0;for(let y=2;y<h;y+=12)for(let x=2;x<w;x+=12){const i=y*w+x;sum+=Math.abs(g[i]-this.previous[i]);n++;}motion=sum/n;}
  const rawMotion=motion;this.previous=g;
  // Compare spatial averages rather than individual text-edge pixels. A small
  // uniform AE change is not card motion; fit a bounded gain and offset below.
  // Keep a fixed anchor throughout a stable interval so slow drift cannot pass
  // merely by taking small steps. This never supplies identity evidence to ORB.
  const mw=Math.ceil(w/4),mh=Math.ceil(h/4),sample=new Float32Array(mw*mh);
  for(let by=0;by<mh;by++)for(let bx=0;bx<mw;bx++){
   let sum=0,n=0;for(let y=by*4;y<Math.min(h,by*4+4);y++)for(let x=bx*4;x<Math.min(w,bx*4+4);x++){sum+=g[y*w+x];n++;}
   sample[by*mw+bx]=sum/n;
  }
  // Fit bounded gain/offset and translation on the four-pixel grid. The fixed anchor is
  // never advanced while stable: cumulative drift still leaves the search area.
  const difference=other=>{
   if(!other||other.length!==sample.length)return {motion:Infinity,light:0,gain:1,shift:null};
   let best={motion:Infinity,light:0,gain:1,shift:null};
   for(let sy=-2;sy<=2;sy++)for(let sx=-2;sx<=2;sx++){
    let sumA=0,sumB=0,sumBB=0,sumAB=0,n=0;const pairs=[];
    for(let y=3;y<mh-3;y+=2)for(let x=3;x<mw-3;x+=2){
     const b=other[(y+sy)*mw+x+sx],a=sample[y*mw+x];
     pairs.push(a,b);sumA+=a;sumB+=b;sumBB+=b*b;sumAB+=a*b;n++;
    }
    const variance=sumBB-sumB*sumB/n,gain=Math.max(.75,Math.min(1.33,variance>1?(sumAB-sumA*sumB/n)/variance:1));
    const offset=Math.max(-24,Math.min(24,(sumA-gain*sumB)/n));let residual=0;
    for(let i=0;i<pairs.length;i+=2)residual+=Math.abs(pairs[i]-gain*pairs[i+1]-offset);
    // Penalize displacement so the bounded search cannot hide sustained drift.
    const score=residual/n+Math.hypot(sx,sy)*.75;
    if(score<best.motion)best={motion:score,light:offset,gain,shift:{x:sx*4,y:sy*4}};
   }
   return best;
  };
  const gap=this.lastAt!==null&&(now-this.lastAt>1000||now<this.lastAt);
  const adjacent=difference(this.motionPrevious),anchored=difference(this.motionAnchor);
  motion=gap?Infinity:Math.max(adjacent.motion,anchored.motion);
  this.motionPrevious=sample;this.lastAt=now;
  const histogram=new Uint32Array(256);for(const value of g)histogram[value]++;
  const percentile=p=>{let total=0;for(let i=0;i<256;i++){total+=histogram[i];if(total>=g.length*p)return i;}return 255;};
  const contrast=percentile(.9)-percentile(.1),brightness=light/g.length;
  const text=zones.every(z=>z.edges>=18&&z.acutance>=24&&z.crisp>=.38);
  // A dark card can still contain usable detail; a uniformly dark/noisy frame cannot.
  const exposure=brightness>18&&brightness<235&&contrast>=20&&clipped/g.length<.23;
  const good=text&&exposure&&motion<6;
  // Text acutance remains the green-guide criterion. Recognition may inspect a
  // stable, well-exposed frame: ORB and final-photo acceptance stay unchanged.
  if(!exposure||motion>=6){this.stableSince=null;this.motionAnchor=sample;}else if(this.stableSince===null)this.stableSince=now;
  const scanReady=this.stableSince!==null&&now-this.stableSince>=600;
  const refusals=[!exposure?'exposure':null,motion>=6?'motion':null,!text?'text_bands':null].filter(Boolean);
  if(!good)this.since=null;else if(this.since===null)this.since=now;
  const ready=good&&now-this.since>=600,progress=ready?1:good?.75:text&&exposure?.4:0;
  const hint=ready?'Image prête · Appuie sur Scanner':!exposure?'Évite les reflets et ajuste la lumière':motion>=6?'Tiens le téléphone immobile':!text?'Rapproche-toi doucement pour rendre les petits textes nets':'Netteté correcte · Garde la position';
  return {ready,scanReady,refusals,progress,hint,zones,motion:Number.isFinite(motion)?motion:null,rawMotion:Number.isFinite(rawMotion)?rawMotion:null,anchorMotion:Number.isFinite(anchored.motion)?anchored.motion:null,lightCompensation:adjacent.light,lightGain:adjacent.gain,adjacentMotion:Number.isFinite(adjacent.motion)?adjacent.motion:null,anchorShift:anchored.shift,exposure,contrast,stableMs:this.stableSince===null?0:now-this.stableSince,motionMethod:'spatial4-registered-anchored-ae',brightness,glare:clipped/g.length};
 }
}
