import {priceHistory,drawHistory} from './price-history.js?v=20261008-4';
// TCGdex exposes aggregate Cardmarket prices, without condition/language slices.
import {variants} from './prices.js?v=20261009-5';
const cache=new Map(),languages={fr:'français',en:'anglais',ja:'japonais'},ids={fr:2,en:1,ja:7};
const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const euros=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n):null;
export function portfolioGain(current,buy){
 if(typeof current!=='number'||!Number.isFinite(current)||current<=0)return null;
 const text=typeof buy==='number'?String(buy):typeof buy==='string'?buy.trim():'';
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(text))return null;
 const purchase=Number(text.replace(',','.'));
 if(!Number.isFinite(purchase)||purchase<0)return null;
 const cents=Math.round(current*100)-Math.round(purchase*100);
 return {value:cents/100,direction:cents>0?'up':cents<0?'down':'equal'};
}
function appendGain(target,current,buy){
 const gain=portfolioGain(current,buy);if(!gain)return;
 const amount=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Math.abs(gain.value));
 const text=gain.direction==='up'?'↑ +'+amount:gain.direction==='down'?'↓ −'+amount:amount;
 const line=node('span',text);line.className='portfolioGain '+gain.direction;
 line.title='Écart estimé avec le prix d’achat, avant frais de vente';
 line.setAttribute('aria-label',(gain.direction==='down'?'Moins-value':gain.direction==='up'?'Plus-value':'Écart')+' estimée : '+(gain.value<0?'moins ':gain.value>0?'plus ':'')+amount);
 target.append(line);
}
export const variantKey=v=>v.pricing.cardmarket?.idProduct||v.ids.cardmarket?"cm:"+String(v.pricing.cardmarket?.idProduct||v.ids.cardmarket):v.ids.tcgplayer?"tp:"+String(v.ids.tcgplayer):"label:"+v.label;
export async function loadPortfolioVariants(card){if(!ids[card.lang])throw Error('Langue non confirmée');const data=await fetchCard(card.id,card.lang);return variants(data).map(v=>({key:variantKey(v),label:v.label}));}
// Same Cardmarket average and saved variant as the portfolio card display.
export function cardmarketValue(data,card,index){
 const choices=variants(data);if(index===undefined){if(choices.length===1)index=0;else{const matches=choices.map((v,i)=>variantKey(v)===card.marketVariant?i:-1).filter(i=>i>=0);if(matches.length!==1)return null;index=matches[0];}}
 const v=choices[index];if(!v)return null;const holo=choices.length===1&&!data.variants_detailed?.length&&card.finish==='Holographique',cm=v.pricing.cardmarket,value=holo?cm?.['avg30-holo']:cm?.avg30;
 return typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
}
export async function collectionValue(cards){
 let next=0,cents=0,priced=0;async function run(){while(next<cards.length){const card=cards[next++];if(!ids[card.lang])continue;try{const data=await fetchCard(card.id,card.lang),value=cardmarketValue(data,card);if(value!==null){cents+=Math.round(value*100);priced++;}}catch{}}}
 await Promise.all([run(),run(),run()]);return {value:cents/100,priced,total:cards.length};
}
async function fetchCard(id,lang){const key=lang+':'+id,old=cache.get(key);if(old&&Date.now()-old.time<3600000)return old.promise;const promise=(async()=>{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);try{const r=await fetch('https://api.tcgdex.net/v2/'+encodeURIComponent(lang)+'/cards/'+encodeURIComponent(id),{signal:ctrl.signal});if(!r.ok)throw Error('Prix indisponibles');const d=await r.json();if(d.id!==id)throw Error('Édition différente');return d;}finally{clearTimeout(timer);}})();cache.set(key,{time:Date.now(),promise});promise.catch(()=>cache.delete(key));return promise;}
let running=0;const queue=[];
function drain(){while(running<3&&queue.length){const job=queue.shift();if(!job.target.isConnected)continue;running++;load(job.target,job.card,job.priceTarget,job.onVariantChange).finally(()=>{running--;drain();});}}
export function loadPortfolioPrice(target,card,priceTarget,onVariantChange){target.className='portfolioQuote';target.append(node('p','Chargement Cardmarket…'));queue.push({target,card,priceTarget,onVariantChange});drain();}
async function load(target,card,priceTarget,onVariantChange){
 const lang=card.lang;if(!ids[lang]){target.replaceChildren(node('p','Confirme la langue pour afficher le prix.'));return;}
 try{const data=await fetchCard(card.id,lang);if(!target.isConnected)return;target.replaceChildren();
 const choices=variants(data),body=node('div');target.append(body);
 const show=i=>{body.replaceChildren();priceTarget.replaceChildren();if(i===''){body.append(node('p','Choisis l’édition pour afficher son repère de prix.'));return;}const v=choices[Number(i)],cm=v.pricing.cardmarket,holo=choices.length===1&&!data.variants_detailed?.length&&card.finish==='Holographique',current=cardmarketValue(data,card,Number(i)),avg=euros(current);const price=node('strong',avg||'Prix indisponible');price.className='portfolioPrice';priceTarget.append(price);appendGain(priceTarget,current,card.buy);body.append(node('small','Moyenne Cardmarket · 30 jours'));const history=priceHistory(lang+':'+card.id+':'+(cm?.idProduct||v.ids.cardmarket||i)+':'+(holo?'holo':'standard'),cm,holo);drawHistory(body,history);if(cm?.updated){const d=new Date(cm.updated);if(!Number.isNaN(+d))body.append(node('p','Données : '+d.toLocaleDateString('fr-FR')));}
 const id=cm?.idProduct||v.ids.cardmarket;if(/^\d+$/.test(String(id))&&Number(id)>0){const a=node('a','Cardmarket · '+languages[lang]);a.href='https://www.cardmarket.com/fr/Pokemon/Products?idProduct='+id+'&language='+ids[lang];a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
 };
 if(choices.length>1){const label=node('label','Édition pour la cote '),select=node('select');select.setAttribute('aria-label','Édition Cardmarket de '+card.name);const empty=node('option','Choisir la variante');empty.value='';select.append(empty);choices.forEach((v,i)=>{const o=node('option',v.label);o.value=i;select.append(o);});const saved=choices.map(variantKey).map((key,i)=>key===card.marketVariant?i:-1).filter(i=>i>=0);if(saved.length===1)select.value=String(saved[0]);select.onchange=()=>{const key=select.value===''?null:variantKey(choices[Number(select.value)]);if(onVariantChange&&!onVariantChange(key))return;show(select.value);};label.append(select);target.insertBefore(label,body);show(select.value);}else show(0);
 }catch{if(target.isConnected){target.replaceChildren(node('p','Prix Cardmarket momentanément indisponibles.'));const retry=node('button','Réessayer les prix');retry.type='button';retry.onclick=()=>{target.replaceChildren(node('p','Chargement Cardmarket…'));queue.push({target,card,priceTarget,onVariantChange});drain();};target.append(retry);}}
}
