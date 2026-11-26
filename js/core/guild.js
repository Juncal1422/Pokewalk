import { positionTooltip } from './message-frame.js';
import { assetUrl } from './asset-url.js';
import {game} from './state.js';
import {element,portrait,gem} from './pokemon-panel.js';
import {playSound} from './audio.js';
import {isUnlocked,relics,saveCollection,emptyCollection,parseCollection} from './collection.js';
import {benefitSynergies} from './benefits.js';
import {labels,statText} from './stats.js';

// R y el ataque básico sólo admiten una sustitución equipada de cada clase.
function equipRelic(id) {
  const entry=relics[id], data=game.collection;
  data.enabled=data.enabled.filter(other=>other!==id && !(entry.slot && relics[other]?.slot===entry.slot) && !(entry.weapon && relics[other]?.weapon));
  data.enabled.push(id);
}

const story=[
  'Bienvenido a *Pommedew*, la capital de los *Gremios de Aventureros*. Ahora que todo el papeleo está finalizado ya puedes empezar a aceptar misiones y, lo mejor, reclamar sus recompensas.',
  'Sólo tienes que *Consultar el tablón* para empezar una Aventura, cuando no puedas más nuestro equipo de rescate irá a por tí y te traerá de vuelta, no cuentes con mantener tus cosas, el servicio tiene un precio jeje',
  'Puedes consultar tus *Aventuras* y descubrimientos en el menú de *Colección*. Las *Misiones* que completes te darán *Emblemas de Aventurero*, que te permitirán comprar en nuestra *Tienda del Gremio*.',
  'Eso es todo, Aventurero, suerte y cuidado con las misiones en papel rojo.'
];
const asset=path=>assetUrl('../../assets/'+path,import.meta.url).href;

const backgrounds = {Pommedew:'home',Beneficios:'benefits',Objetos:'items','Tablón de misiones':'missions','Pokédex':'pokedex',Reliquias:'relics'};
const sectionArt = {'Tienda del Gremio':'shop','Pokédex':'pokedex',Objetos:'items',Beneficios:'benefits',Reliquias:'relics'};
const menuImages = new Map();

// Retiene las imágenes decodificadas usando las mismas rutas que el CSS.
export async function preloadMenuArt(app) {
  const theme = getComputedStyle(app);
  const properties = [
    '--guild-default-background',
    ...Object.values(sectionArt).map(section => '--catalog-' + section + '-art'),
    ...Object.values(backgrounds).flatMap(section => [
      '--guild-' + section + '-background-1', '--guild-' + section + '-background-2',
    ]),
  ];
  await Promise.all(properties.map(async property => {
    const url = theme.getPropertyValue(property).trim().match(/^url\(["']?([^"']+?)["']?\)$/)?.[1];
    if (!url || menuImages.has(url)) return;
    const image = new Image();
    image.src = url;
    await image.decode();
    menuImages.set(url, image);
  }));
}

// Crea un control nativo que también funciona con teclado.
function button(label,action,sound='select') {
  const control=element('button',label);
  control.onclick=()=>{playSound(sound);action()};
  return control;
}

// Usa un solo diálogo modal para impedir que los controles del mundo reciban eventos del gremio.
function screen(title) {
  const dialog=document.querySelector('#guild-screen');
  dialog.replaceChildren();
  dialog.className='';
  const section = backgrounds[title];
  const background = section ? '--guild-' + section + '-background-' + (Math.random() < .5 ? '1' : '2') : '--guild-default-background';
  dialog.style.setProperty('--guild-background-image', title ? 'var(' + background + ')' : 'none');
  if(title)dialog.append(element('h1',title));
  dialog.oncancel=event=>event.preventDefault();
  if(!dialog.open)dialog.showModal();
  return dialog;
}

// Un clic completa la frase; el siguiente avanza. El énfasis conserva el ritmo letra por letra.
async function introduction() {
  for(const message of story) await new Promise(resolve=>{
    const dialog=screen('');
    dialog.className='guild-introduction';
    const box=element('button');box.className='guild-introduction-message';box.setAttribute('aria-label',message.replaceAll('*',''));
    const letters=[];
    message.split('*').forEach((segment,index)=>{
      const span=element(index%2?'strong':'span');box.append(span);
      for(const char of segment)letters.push([span,char]);
    });
    let position=0;
    const write=()=>{const [span,char]=letters[position++];span.append(char)};
    const timer=setInterval(()=>{if(position<letters.length)write();else clearInterval(timer)},23);
    box.onclick=()=>{playSound('select');clearInterval(timer);if(position<letters.length){while(position<letters.length)write()}else resolve()};
    dialog.append(box);box.focus();
  });
  game.collection.intro=true;saveCollection();
}

// Pagina también las listas largas en pantallas pequeñas sin desbordar el diálogo.
function listPage(title,entries,page,back) {
  const dialog=screen(title), tiled=Object.hasOwn(sectionArt,title);

  const pageSize=tiled?64:(innerHeight<460?2:4);
  const pages=Math.max(1,Math.ceil(entries.length/pageSize));
  page=Math.min(page,pages-1);
  const body=element('section');body.className=tiled?'catalog-item-board':'guild-record-list';
  for(const build of entries.slice(page*pageSize,(page+1)*pageSize))body.append(build());
  if(tiled){
    body.style.setProperty('--catalog-art','var(--catalog-' + sectionArt[title] + '-art)');
    const tip=element('aside');tip.className='catalog-tooltip';tip.hidden=true;tip.setAttribute('role','tooltip');
    for(const cell of body.children){
      const label=cell.textContent.trim(),detail=cell.title;
      cell.removeAttribute('title');cell.setAttribute('aria-label',label);
      for(const node of [...cell.childNodes])if(node.nodeType===3)node.remove();
      const show=event=>{tip.textContent=[label,detail].filter(Boolean).join(' · ');tip.hidden=false;positionTooltip(tip,event,cell);};
      cell.onpointermove=event=>positionTooltip(tip,event,cell);
      cell.onpointerenter=cell.onfocus=show;cell.onpointerleave=cell.onblur=()=>{tip.hidden=true;};
    }
    while(body.children.length<64)body.append(element('span'));
    dialog.append(tip);
  }
  if(!tiled && !entries.length)body.append(element('p','Todavía no hay registros.'));
  dialog.append(body);
  const nav=element('nav');
  if(pages>1){
    for(const [step,arrow] of [[-1,'w'],[1,'e']]){
      const control=button('',()=>listPage(title,entries,page+step,back));
      control.setAttribute('aria-label',step<0?'Anterior':'Siguiente');control.disabled=page+step<0||page+step>=pages;
      control.append(icon('ui/arrow_'+arrow+'.png'));nav.append(control);
      if(step<0)nav.append(element('span',(page+1)+' / '+pages));
    }
  }
  nav.append(button('Volver',back));dialog.append(nav);
}

// Los recursos de interfaz se resuelven junto al módulo tanto en local como en el CDN.
function icon(path) {const image=new Image();image.src=asset(path);image.alt='';return image}

// La crónica reúne todas las misiones en una vista. Los iconos conservan nombres
// accesibles y una entrada antigua sigue siendo legible aunque falte su recurso.
function historyDetail(run,back) {
  const dialog=screen('Aventura · Nv. '+run.level);
  const record=element('article');record.className='adventure-summary';
  record.append(element('p',new Date(run.date).toLocaleDateString('es')+' · '+run.status));
  const stats=Object.entries(run.stats).map(([key,v])=>(labels[key]??key)+' '+statText(key,v));
  if(run.hp!=null)stats.unshift('PV restantes '+run.hp);
  record.append(element('p',stats.join(' · ')));
  for(const [title,ids,lookup,isForm] of [
    ['Formas',run.forms,id=>game.pokemon.get(id),true],
    ['Objetos',run.items,id=>game.items[id],false],
    ['Beneficios',run.benefits,id=>game.benefits.get(id),false]
  ]){
    const section=element('section');section.append(element('strong',title+' '));
    for(const id of ids){
      const entry=lookup(id);
      if(!entry){section.append(element('span',String(id)));continue;}
      const image=isForm?portrait(entry):icon(entry.image.replace('assets/',''));
      image.alt=image.title=entry.name;section.append(image);
    }
    record.append(section);
  }
  const missions=element('ol');
  for(const [index,mission] of run.missions.entries()){
    const row=element('li',mission.name+(mission.red?' · Roja':'')+' · '+mission.biome+' · Piso '+mission.floor+'/'+mission.floors+' · '+mission.status+' · '+mission.reward+' emblemas');
    row.value=mission.number ?? index+1;
    if(mission.kills!=null)row.append(' · '+mission.kills+' bajas');
    if(mission.quota)row.append(' · Objetivo '+mission.quota);
    missions.append(row);
  }
  record.append(missions);dialog.append(record,button('Volver',back));
  // Ajusta incluso una crónica larga en el espacio que dejan título y botón.
  function fit(){
    if(!record.isConnected)return;
    record.style.zoom=1;
    const available=dialog.clientHeight-dialog.querySelector('h1').offsetHeight-dialog.querySelector('button').offsetHeight-90;
    record.style.zoom=Math.max(.01,Math.min(1,available/Math.max(1,record.scrollHeight)));
  }
  fit();const observer=new ResizeObserver(fit);observer.observe(dialog);
  const cleanup=new MutationObserver(()=>{if(!record.isConnected){observer.disconnect();cleanup.disconnect();}});
  cleanup.observe(dialog,{childList:true});
}

// Muestra la ficha base y el don asociado con la misma fuente que usa el combate.
function speciesPage(row,back){
  const dialog=screen(row.name), card=element('section');card.className='species-profile';
  card.append(portrait(row),...row.essences.map(gem));
  for(const [key,value] of Object.entries(row.stats))card.append(element('p',(labels[key]??key)+' · '+value));
  const benefit=game.donors.get(row.name);
  if(benefit){const image=icon(benefit.image.replace('assets/',''));image.alt=image.title=benefit.name;card.append(image);}
  dialog.append(card,button('Volver',back));
}

// El mismo texto de sinergias está disponible al señalar o enfocar un icono.
function catalogCard(id,record,action){
  if(!record)return element('p',id);
  const card=button(record.name,action??(()=>{}));card.prepend(icon(record.image.replace('assets/','')));
  card.title=record.description;
  return card;
}

// Las listas guardan identificadores. Los nombres e iconos se resuelven con el catálogo actual.
function collectionMenu(back) {
  const dialog=screen('Colección'),again=()=>collectionMenu(back),data=game.collection;
  const lists={
    Historial:data.history.slice().reverse().map(run=>()=>button(new Date(run.date).toLocaleDateString('es')+' · '+run.status+' · '+run.missions.length+' misiones',()=>historyDetail(run,()=>open('Historial')))),
    Pokédex:[...game.pokemon.keys()].map(id=>()=>{const row=game.pokemon.get(id);
      if(!row)return element('p',String(id));
      const card=button(row.name,()=>speciesPage(row,()=>open('Pokédex')));
      card.prepend(portrait(row));return card;
    }),
    Objetos:Object.keys(game.items).map(id=>()=>catalogCard(id,game.items[id])),
    Beneficios:[...game.benefits.keys()].map(id=>()=>catalogCard(id,game.benefits.get(id),()=>{
      const benefit=game.benefits.get(id);
      const donors=[...game.pokemon.values()].filter(row=>benefit?.pokemon.includes(row.name));
      const combinations=benefitSynergies(id).map(text=>()=>element('p',text));
      listPage(benefit?.name??id,[...combinations,...donors.map(row=>()=>{const entry=element('p',row.name);entry.prepend(portrait(row));return entry})],0,()=>open('Beneficios'));
    })),
    Reliquias:Object.keys(relics).filter(id=>!relics[id].biome || isUnlocked('relics',id)).map(id=>()=>{const enabled=data.enabled.includes(id);const control=button((enabled?'Activa · ':'Inactiva · ')+(relics[id]?.name??id),()=>{
      if(relics[id].purchasable && !data.relics.includes(id))return shop(again);
      if(!data.relics.includes(id))data.relics.push(id);
      if(enabled)data.enabled=data.enabled.filter(key=>key!==id);else equipRelic(id);saveCollection();open('Reliquias')});control.title=relics[id].description;control.setAttribute('aria-pressed',enabled);control.prepend(icon(relics[id].image??'relics/'+id+'.png'));return control})
  };
  // Reconstruye la página para reflejar inmediatamente la activación de reliquias.
  function open(name){listPage(name,lists[name],0,again)}
  const grid=element('section');grid.className='collection-menu-grid';
  for(const name of Object.keys(lists)){
    const entry=button(name,()=>open(name));grid.append(entry);
  }
  dialog.append(grid);
  dialog.append(button('Volver',back));
}

// Compra y saldo se escriben juntos. Las reliquias nuevas quedan activadas.
function shop(back) {
  const entries=Object.entries(relics).filter(([id,r])=>!r.biome || isUnlocked('relics',id)).map(([id,relic])=>()=>{
    const card=button(relic.name,()=>{
      if(!game.collection.relics.includes(id)){
        if(relic.purchasable){
          if(game.collection.emblems<relic.price)return;
          game.collection.emblems-=relic.price;
        }
        game.collection.relics.push(id);
      }
      equipRelic(id);
      saveCollection();shop(back);
    });
    const buying=relic.purchasable && !game.collection.relics.includes(id);
    card.setAttribute('aria-disabled',String(!!buying && game.collection.emblems<relic.price));
    card.append(buying?' · 1 emblema':'');
    card.title=relic.description+' · '+(buying?'1 emblema · Saldo '+game.collection.emblems:game.collection.enabled.includes(id)?'Activa':'Activar');
    card.append(icon(relic.image??'relics/'+id+'.png'));return card;
  });
  listPage('Tienda del Gremio',entries,0,back);
}

// Una acción destructiva o una importación requiere una segunda elección dentro del juego.
function confirmChange(message,accept,cancel) {
  const dialog=screen('Ajustes');
  const prompt=element('p',message);prompt.className='guild-confirmation-message';
  dialog.append(prompt,button('Cancelar',cancel),button('Confirmar',accept));
}

// Exportar e importar operan sobre el mismo formato versionado. Borrar exige confirmación.
function settings(back) {
  const dialog=screen('Ajustes'),volume=element('input'),label=element('label','Volumen ');
  volume.type='range';volume.min=0;volume.max=100;volume.value=Math.round(game.collection.volume*100);
  volume.oninput=()=>{game.collection.volume=Number(volume.value)/100;saveCollection()};volume.onchange=()=>playSound('accept');label.append(volume);
  const file=element('input');file.type='file';file.accept='.json';file.hidden=true;
  file.onchange=async()=>{try{if(!file.files.length)return;const data=parseCollection(await file.files[0].text());
    confirmChange('¿Reemplazar tu colección por la del archivo?',()=>{saveCollection(data);back()},()=>settings(back))}catch(error){dialog.append(element('p',error.message))}};
  dialog.append(label,button('Exportar partida guardada',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(game.collection,null,2)],{type:'application/json'}));
    const link=element('a');link.href=url;link.download='Pommedew.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }),file,button('Importar partida guardada',()=>file.click()),button('Eliminar partida guardada',()=>{
    confirmChange('¿Eliminar la colección, el historial y todos los emblemas?',()=>{saveCollection(emptyCollection());back()},()=>settings(back))
  }),button('Volver',back));
}

// Espera una nueva aventura; las pantallas secundarias siempre vuelven al mismo menú.
export async function visitGuild() {
  if(!game.collection.intro)await introduction();
  await new Promise(resolve=>{
    // Importar o eliminar puede cambiar si ya se ha leído la bienvenida.
    async function home(){if(!game.collection.intro)await introduction();const dialog=screen('Pommedew');dialog.append(button('Nueva Aventura',resolve),button('Tienda del Gremio',()=>shop(home)),
      button('Colección',()=>collectionMenu(home)),button('Ajustes',()=>settings(home)))}
    home();
  });
}

// Conserva las ofertas generadas hasta que se selecciona una de ellas.
export function selectMission(offers) {
  return new Promise(resolve=>{
    const dialog=screen('Tablón de misiones'),grid=element('section');grid.className='mission-offer-grid';grid.style.setProperty('--mission-offer-count',offers.length);
    for(const mission of offers){
      const card=button('',()=>{dialog.close();resolve(mission)},'mission');card.className='mission-offer-card';
      if(mission.red){card.classList.add('red-mission-offer');card.append(element('small','Papel rojo · +15 niveles'))}
      card.append(element('strong',mission.name),element('span',mission.biome.name+' · '+mission.floors+' pisos'));
      const portraits=element('div');
      if(mission.type!=='leader')for(const id of mission.pool)portraits.append(portrait(game.pokemon.get(id)));
      card.append(portraits,element('b',mission.reward+' emblemas'));grid.append(card);
    }
    dialog.append(grid);
  });
}

// Mantiene visible un error de carga hasta que se vuelve al gremio.
export function guildMessage(message) {
  return new Promise(resolve=>{
    const dialog=screen('Pommedew');
    dialog.append(element('p',message),button('Volver al gremio',resolve));
  });
}
