// A quality guide, never an identity check or a guarantee that OCR can read every letter.
export class FocusGate {
 constructor(){this.reset();}
 reset(){this.previous=null;this.since=null;}
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
  this.previous=g;
  const text=zones.every(z=>z.edges>=18&&z.acutance>=24&&z.crisp>=.38),exposure=light/g.length>42&&light/g.length<235&&clipped/g.length<.23;
  const good=text&&exposure&&motion<5;
  if(!good)this.since=null;else if(this.since===null)this.since=now;
  const ready=good&&now-this.since>=600,progress=ready?1:good?.75:text&&exposure?.4:0;
  const hint=ready?'Image prête · Appuie sur Scanner':!exposure?'Évite les reflets et ajuste la lumière':motion>=5?'Tiens le téléphone immobile':!text?'Rapproche-toi doucement pour rendre les petits textes nets':'Netteté correcte · Garde la position';
  return {ready,progress,hint,zones,motion:Number.isFinite(motion)?motion:null,brightness:light/g.length,glare:clipped/g.length};
 }
}
