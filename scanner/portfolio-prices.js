import {priceHistory,drawHistory} from './price-history.js?v=20261008-4';
// TCGdex exposes aggregate Cardmarket prices, without condition/language slices.
import {variants} from './prices.js?v=20261007-4';
const cache=new Map(),languages={fr:'français',en:'anglais',ja:'japonais'},ids={fr:2,en:1,ja:7};
const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const euros=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n):null;
async function fetchCard(id,lang){const key=lang+':'+id,old=cache.get(key);if(old&&Date.now()-old.time<3600000)return old.promise;const promise=(async()=>{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);try{const r=await fetch('https://api.tcgdex.net/v2/'+encodeURIComponent(lang)+'/cards/'+encodeURIComponent(id),{signal:ctrl.signal});if(!r.ok)throw Error('Prix indisponibles');const d=await r.json();if(d.id!==id)throw Error('Édition différente');return d;}finally{clearTimeout(timer);}})();cache.set(key,{time:Date.now(),promise});promise.catch(()=>cache.delete(key));return promise;}
let running=0;const queue=[];
function drain(){while(running<3&&queue.length){const job=queue.shift();if(!job.target.isConnected)continue;running++;load(job.target,job.card,job.priceTarget).finally(()=>{running--;drain();});}}
export function loadPortfolioPrice(target,card,priceTarget){target.className='portfolioQuote';target.append(node('p','Chargement Cardmarket…'));queue.push({target,card,priceTarget});drain();}
async function load(target,card,priceTarget){
 const lang=card.lang;if(!ids[lang]){target.replaceChildren(node('p','Confirme la langue pour afficher le prix.'));return;}
 try{const data=await fetchCard(card.id,lang);if(!target.isConnected)return;target.replaceChildren();
 const choices=variants(data),body=node('div');target.append(body);
 const show=i=>{body.replaceChildren();priceTarget.replaceChildren();if(i===''){body.append(node('p','Choisis l’édition pour afficher son repère de prix.'));return;}const v=choices[Number(i)],cm=v.pricing.cardmarket,holo=choices.length===1&&!data.variants_detailed?.length&&card.finish==='Holographique',avg=euros(holo?cm?.['avg30-holo']:cm?.avg30);const price=node('strong',avg||'Prix indisponible');price.className='portfolioPrice';priceTarget.append(price);body.append(node('small','Moyenne Cardmarket · 30 jours'));const history=priceHistory(lang+':'+card.id+':'+(cm?.idProduct||v.ids.cardmarket||i)+':'+(holo?'holo':'standard'),cm,holo);drawHistory(body,history);if(cm?.updated){const d=new Date(cm.updated);if(!Number.isNaN(+d))body.append(node('p','Données : '+d.toLocaleDateString('fr-FR')));}
 const id=cm?.idProduct||v.ids.cardmarket;if(/^\d+$/.test(String(id))&&Number(id)>0){const a=node('a','Cardmarket · '+languages[lang]);a.href='https://www.cardmarket.com/fr/Pokemon/Products?idProduct='+id+'&language='+ids[lang];a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
 };
 if(choices.length>1){const label=node('label','Édition pour la cote '),select=node('select');select.setAttribute('aria-label','Édition Cardmarket de '+card.name);const empty=node('option','Choisir la variante');empty.value='';select.append(empty);choices.forEach((v,i)=>{const o=node('option',v.label);o.value=i;select.append(o);});select.onchange=()=>show(select.value);label.append(select);target.insertBefore(label,body);show('');}else show(0);
 }catch{if(target.isConnected){target.replaceChildren(node('p','Prix Cardmarket momentanément indisponibles.'));const retry=node('button','Réessayer les prix');retry.type='button';retry.onclick=()=>{target.replaceChildren(node('p','Chargement Cardmarket…'));queue.push({target,card,priceTarget});drain();};target.append(retry);}}
}
