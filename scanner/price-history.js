// Only store dated daily averages actually returned by the provider.
const DAY=86400000,ns='http://www.w3.org/2000/svg';
export function priceHistory(key,pricing,holo=false,now=Date.now()){
 const storageKey='tcgPriceHistory:v1:'+key;let rows=[];try{rows=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(rows))rows=[];}catch{}
 const value=pricing?.[holo?'avg1-holo':'avg1'],stamp=Date.parse(pricing?.updated),today=new Date(now).toISOString().slice(0,10),cut=Date.parse(today)-29*DAY;
 rows=rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Date.parse(r.date)>=cut&&Date.parse(r.date)<=now&&typeof r.value==='number'&&Number.isFinite(r.value)&&r.value>0);
 if(Number.isFinite(stamp)&&stamp>=cut&&stamp<=now&&typeof value==='number'&&Number.isFinite(value)&&value>0){const date=new Date(stamp).toISOString().slice(0,10);rows=rows.filter(r=>r.date!==date);rows.push({date,value});}
 rows.sort((a,b)=>a.date.localeCompare(b.date));try{localStorage.setItem(storageKey,JSON.stringify(rows));}catch{}return rows;
}
export function drawHistory(target,rows){
 const label=document.createElement('p');label.className='historyLabel';label.textContent='Prix · 30 derniers jours';target.append(label);
 if(!rows.length){const p=document.createElement('small');p.textContent='Historique indisponible';target.append(p);return;}
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 180 80');svg.setAttribute('role','img');svg.setAttribute('aria-label','Relevés Cardmarket disponibles : '+rows.length+' jour(s).');svg.classList.add('priceHistory');
 const today=Date.parse(new Date().toISOString().slice(0,10)),start=today-29*DAY,values=rows.map(r=>r.value),lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||Math.max(1,hi*.1);
 const points=rows.map(r=>({x:8+(Date.parse(r.date)-start)/(29*DAY)*164,y:58-(r.value-lo)/range*40,...r}));
 if(points.length>1){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.map(p=>p.x+','+p.y).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','2');svg.append(line);}
 for(const p of points){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.setAttribute('r','3');dot.setAttribute('fill','currentColor');const title=document.createElementNS(ns,'title');title.textContent=p.date+' · '+p.value.toFixed(2)+' €';dot.append(title);svg.append(dot);}
 target.append(svg);const note=document.createElement('small');note.textContent=rows.length+' relevé(s) disponible(s) · moyenne quotidienne';target.append(note);
}
