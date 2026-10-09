// Market data is requested only after the user has identified a card. No image is sent.
const cache=new Map();
const money=(n,unit)=>typeof n==='number'&&Number.isFinite(n)&&n>0?new Intl.NumberFormat('fr-FR',{style:'currency',currency:unit}).format(n):'Indisponible';
const labels={'normal':'Normale','holofoil':'Holo','holo':'Holo','reverse':'Reverse','reverse-holofoil':'Reverse','1st-edition':'1re édition','1st-edition-holofoil':'1re édition holo','unlimited':'Illimitée','unlimited-holofoil':'Illimitée holo'};
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
export function variants(card){
 if(card.variants_detailed?.length)return card.variants_detailed.map(v=>({label:[v.type,v.subtype,...(Array.isArray(v.stamp)?v.stamp:[]),v.size].filter(Boolean).join(' · '),pricing:v.pricing||{},ids:v.thirdParty||{}}));
 return [{label:'Données générales · variante non confirmée',pricing:card.pricing||{},ids:{}}];
}
function updated(value){const d=new Date(value);return value&&!Number.isNaN(+d)?'Mise à jour : '+d.toLocaleString('fr-FR')+(Date.now()-d>7*86400000?' · données anciennes':''):'Date de mise à jour non fournie';}
function link(url,label){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function productId(n){return /^\d+$/.test(String(n))&&Number(n)>0?String(n):null;}
export function renderPrices(target,card,lang){
 target.replaceChildren();
 const list=variants(card),label=node('label','Variante pour les prix '),select=node('select');select.id='priceVariant';
 if(list.length>1){const o=node('option','Choisir la variante exacte');o.value='';select.append(o);}
 list.forEach((v,i)=>{const o=node('option',v.label);o.value=String(i);select.append(o);});label.append(select);target.append(label);
 const grid=node('div',undefined,'priceGrid');target.append(grid);
 const render=()=>{
  grid.replaceChildren();if(select.value===''){grid.append(node('p','Confirme la variante pour afficher ses prix.'));return;}
  const v=list[Number(select.value)],cm=v.pricing.cardmarket,tp=v.pricing.tcgplayer;
  const eu=node('article',undefined,'marketPrice');eu.append(node('h4','Cardmarket · EUR'));const notice=node('p',lang==='ja'?'Édition japonaise demandée · correspondance à vérifier sur la fiche.':'Langues regroupées · pas de cote française ou anglaise distincte.','muted');
  if(cm){
   eu.append(node('p',money(cm.trend,'EUR'),'scanMarketValue'),node('p','Tendance Cardmarket','muted'));
   eu.append(node('p','Moyenne 30 jours : '+money(cm.avg30,'EUR')));
   if(typeof cm['trend-holo']==='number'&&cm['trend-holo']>0)eu.append(node('p','Autre série « holo » de la source : '+money(cm['trend-holo'],'EUR')+' · finition à vérifier sur la fiche.','muted'));
   eu.append(node('p',updated(cm.updated),'muted'));
  }else eu.append(node('p','Prix indisponible pour cette variante.'));
  eu.append(notice);
  const cmid=productId(cm?.idProduct)||productId(v.ids.cardmarket);
  if(cmid)eu.append(link('https://www.cardmarket.com/fr/Pokemon/Products?idProduct='+cmid+'&language='+(lang==='fr'?'2':lang==='ja'?'7':'1'),'Voir la fiche Cardmarket · vérifier la langue'));
  const us=node('article',undefined,'marketPrice');us.append(node('h4','TCGplayer · USD'),node('p',lang==='fr'?'Référence du marché américain · pas une cote de la carte française.':lang==='ja'?'Édition japonaise demandée · vérifie la langue sur la fiche du vendeur.':'Référence du marché américain · langue non certifiée par la source.','muted'));
  let count=0;const links=new Set();
  for(const [key,p] of Object.entries(tp||{})){
   if(!p||typeof p!=='object')continue;
   us.append(node('p',(labels[key]||key)+' · prix marché : '+money(p.marketPrice,'USD'),'priceValue'));count++;
   const id=productId(p.productId);if(id)links.add(id);
  }
  if(!count)us.append(node('p','Prix indisponible pour cette variante.'));
  if(tp)us.append(node('p',updated(tp.updated),'muted'));
  const tpid=productId(v.ids.tcgplayer);if(!links.size&&tpid)links.add(tpid);
  for(const id of links)us.append(link('https://www.tcgplayer.com/product/'+id,'Voir la fiche TCGplayer'));
  grid.append(eu,us);
 };
 select.onchange=render;render();
 target.append(node('p','Prix indicatifs fournis par TCGdex, hors livraison ; l’état et la langue peuvent changer le prix. Vérifie l’édition sur la fiche du vendeur.','muted'));
}
export function createPricePanel(target){
 let generation=0,controller;
 const load=async(card,lang)=>{
  const current=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal;
  target.replaceChildren(node('p','Chargement des prix…'));const key=lang+':'+card.id;
  const cached=cache.get(key);if(cached&&Date.now()-cached.time<3600000){renderPrices(target,cached.data,lang);return;}
  const timeout=setTimeout(()=>controller?.signal===signal&&controller.abort(),12000);
  try{
   const response=await fetch('https://api.tcgdex.net/v2/'+encodeURIComponent(lang)+'/cards/'+encodeURIComponent(card.id),{signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();if(data.id!==card.id)throw Error('Carte différente');
   if(current!==generation)return;
   cache.set(key,{data,time:Date.now()});renderPrices(target,data,lang);
  }catch{
   if(current!==generation)return;
   target.replaceChildren(node('p','Prix momentanément indisponibles. Vérifie ta connexion.'));const retry=node('button','Réessayer les prix');retry.type='button';retry.onclick=()=>load(card,lang);target.append(retry);
  }finally{clearTimeout(timeout);}
 };
 return load;
}
