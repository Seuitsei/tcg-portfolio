const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function createCatalog({rpc,choose,navigate,imageURL,getLang,changeLang}){
 const $=id=>document.getElementById(id);let token=0,cards=[],active=null;
 const language=node('label','Langue des cartes'),select=node('select');
 for(const [value,text] of [['fr','Français'],['en','English'],['ja','日本語 · Japonais (partiel)']]){const o=node('option',text);o.value=value;select.append(o);}
 language.append(select);$('catalogHelp').after(language);select.onchange=()=>{close();changeLang(select.value);};
 const view=node('div');view.hidden=true;
 const back=node('button','← Toutes les extensions');back.type='button';back.className='text';back.onclick=close;
 const title=node('h2'),filter=node('input');filter.type='search';filter.placeholder='Nom ou numéro de carte';filter.setAttribute('aria-label','Rechercher dans cette extension');
 const state=node('p'),grid=node('div');state.setAttribute('role','status');grid.className='catalogGrid';view.append(back,title,filter,state,grid);$('setList').after(view);filter.oninput=render;
 function close(){token++;active=null;cards=[];view.hidden=true;$('setList').hidden=false;$('setFilter').hidden=false;grid.replaceChildren();}
 function render(){
 const term=filter.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const visible=cards.filter(c=>(c.name+' '+c.localId).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term));
 state.textContent=visible.length+' carte(s)'+(visible.length?' · Choisis une carte pour l’ajouter au classeur.':' · Aucun résultat.');
 grid.replaceChildren(...visible.map(c=>{
 const button=node('button');button.type='button';button.className='catalogCard';button.setAttribute('aria-label','Choisir '+c.name+' '+c.localId);
 const placeholder=node('span','Image indisponible');placeholder.className='catalogPlaceholder';
 if(c.image){const img=node('img');img.src=imageURL(c);img.alt=c.name;img.loading='lazy';img.onerror=()=>img.replaceWith(placeholder);button.append(img);}else button.append(placeholder);
 button.append(node('strong',c.name),node('span',c.localId));
 button.onclick=()=>{navigate('scan');choose(c);document.getElementById('selection').scrollIntoView({behavior:'smooth',block:'start'});};return button;
 }));
 }
 async function open(set){
 const request=++token;active=set.id;select.value=getLang();view.hidden=false;$('setList').hidden=true;$('setFilter').hidden=true;title.textContent=set.name;filter.value='';cards=[];grid.replaceChildren();state.textContent='Chargement des cartes…';
 try{const result=await rpc('setCards',{setId:set.id});if(request!==token)return;cards=result;render();}
 catch(e){if(request!==token)return;state.textContent=e.message;const retry=node('button','Réessayer');retry.onclick=()=>open(set);grid.append(retry);}
 }
 return {open,reset:close,sync(){select.value=getLang();}};
}
