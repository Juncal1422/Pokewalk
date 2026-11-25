import { assetUrl } from './asset-url.js';
import {game} from './state.js';
import {element,portrait,gem} from './pokemon-panel.js';
import {playSound} from './audio.js';
import {relics,saveCollection,emptyCollection,parseCollection} from './collection.js';
import {synergyText} from './benefits.js';
import {labels} from './stats.js';

const story=[
  'Bienvenido a *Pommedew*, la capital de los *Gremios de Aventureros*. Ahora que todo el papeleo está finalizado ya puedes empezar a aceptar misiones y, lo mejor, reclamar sus recompensas.',
  'Sólo tienes que *Consultar el tablón* para empezar una Aventura, cuando no puedas más nuestro equipo de rescate irá a por tí y te traerá de vuelta, no cuentes con mantener tus cosas, el servicio tiene un precio jeje',
  'Puedes consultar tus *Aventuras* y descubrimientos en el menú de *Colección*. Las *Misiones* que completes te darán *Emblemas de Aventurero*, que te permitirán comprar en nuestra *Tienda de Aventureros*.',
  'Eso es todo, Aventurero, suerte y cuidado con las misiones en papel rojo.'
];
const asset=path=>assetUrl('../../assets/'+path,import.meta.url).href;

// Crea un control nativo que también funciona con teclado.
function button(label,action) {
  const control=element('button',label);
  control.onclick=()=>{playSound('select');action()};
  return control;
}

// Usa un solo diálogo modal para impedir que los controles del mundo reciban eventos del gremio.
function screen(title) {
  const dialog=document.querySelector('#guild');
  dialog.replaceChildren();
  dialog.className='';
  if(title)dialog.append(element('h1',title));
  dialog.oncancel=event=>event.preventDefault();
  if(!dialog.open)dialog.showModal();
  return dialog;
}

// Un clic completa la frase; el siguiente avanza. El énfasis conserva el ritmo letra por letra.
async function introduction() {
  for(const message of story) await new Promise(resolve=>{
    const dialog=screen('');
    dialog.className='story';
    const box=element('button');box.className='letterbox';box.setAttribute('aria-label',message.replaceAll('*',''));
    const letters=[];
    message.split('*').forEach((segment,index)=>{
      const span=element(index%2?'strong':'span');box.append(span);
      for(const char of segment)letters.push([span,char]);
    });
    let position=0;
    const write=()=>{const [span,char]=letters[position++];span.append(char)};
    const timer=setInterval(()=>{if(position<letters.length)write();else clearInterval(timer)},23);
    box.onclick=()=>{clearInterval(timer);if(position<letters.length){while(position<letters.length)write()}else resolve()};
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
  const body=element('section');body.className=tiled?'catalog-board':'guild-list';
  for(const build of entries.slice(page*pageSize,(page+1)*pageSize))body.append(build());
  if(tiled){
    body.style.setProperty('--catalog-art','url("'+asset('ui/'+sectionArt[title]+'.png')+'")');
    const tip=element('aside');tip.className='catalog-tip';tip.hidden=true;tip.setAttribute('role','tooltip');
    for(const cell of body.children){
      const label=cell.textContent.trim(),detail=cell.title;
      cell.removeAttribute('title');cell.setAttribute('aria-label',label);
      for(const node of [...cell.childNodes])if(node.nodeType===3)node.remove();
      const show=()=>{tip.textContent=[label,detail].filter(Boolean).join(' · ');tip.hidden=false;};
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

// El detalle del historial usa páginas también para misiones, especies y equipo.
function historyDetail(run,back) {
  const rows=[...Object.entries(run.stats).map(([key,v])=>(labels[key]??key)+' '+v),
    ...run.missions.map((m,i)=>(i+1)+'. '+m.name+(m.red?' · Roja':'')+' · '+m.biome+' · Piso '+m.floor+'/'+m.floors+' · '+m.status+' · '+m.reward+' emblemas'),
    ...run.forms.map(id=>'Forma · '+(game.pokemon.get(id)?.name??id)),...run.items.map(id=>game.items[id]?.name??id),
    ...run.benefits.map(id=>game.benefits.get(id)?.name??id)];
  listPage('Aventura · Nv. '+run.level,rows.map(text=>()=>element('p',text)),0,back);
}

const sectionArt={'Tienda de Aventureros':'shop','Pokédex':'pokedex',Objetos:'objetos',Beneficios:'beneficios',Reliquias:'reliquias'};

// Muestra la ficha base y el don asociado con la misma fuente que usa el combate.
function speciesPage(row,back){
  const dialog=screen(row.name), card=element('section');card.className='species-card';
  card.append(portrait(row),...row.essences.map(gem));
  for(const [key,value] of Object.entries(row.stats))card.append(element('p',(labels[key]??key)+' · '+value));
  const benefit=game.donors.get(row.name);
  if(benefit)card.append(element('p',benefit.name+' · '+benefit.description));
  dialog.append(card,button('Volver',back));
}

// El mismo texto de sinergias está disponible al señalar o enfocar un icono.
function catalogCard(id,record,action){
  if(!record)return element('p',id);
  const card=button(record.name,action??(()=>{}));card.prepend(icon(record.image.replace('assets/','')));
  card.title=[record.description,synergyText(id)].filter(Boolean).join(' · ');
  return card;
}

// Las listas guardan identificadores. Los nombres e iconos se resuelven con el catálogo actual.
function collectionMenu(back) {
  const dialog=screen('Colección'),again=()=>collectionMenu(back),data=game.collection;
  const lists={
    Historial:data.history.slice().reverse().map(run=>()=>button(new Date(run.date).toLocaleDateString('es')+' · '+run.status+' · '+run.missions.length+' misiones',()=>historyDetail(run,again))),
    Pokédex:[...game.pokemon.keys()].map(id=>()=>{const row=game.pokemon.get(id);
      if(!row)return element('p',String(id));
      const card=button(row.name,()=>speciesPage(row,()=>open('Pokédex')));
      card.prepend(portrait(row));return card;
    }),
    Objetos:Object.keys(game.items).map(id=>()=>catalogCard(id,game.items[id])),
    Beneficios:[...game.benefits.keys()].map(id=>()=>catalogCard(id,game.benefits.get(id),()=>{
      const benefit=game.benefits.get(id);
      const donors=[...game.pokemon.values()].filter(row=>benefit?.pokemon.includes(row.name));
      listPage(benefit?.name??id,donors.map(row=>()=>{const entry=element('p',row.name);entry.prepend(portrait(row));return entry}),0,()=>open('Beneficios'));
    })),
    Reliquias:Object.keys(relics).map(id=>()=>{const enabled=data.enabled.includes(id);const control=button((enabled?'Activa · ':'Inactiva · ')+(relics[id]?.name??id),()=>{
      if(!data.relics.includes(id))data.relics.push(id);
      data.enabled=enabled?data.enabled.filter(key=>key!==id):[...data.enabled,id];saveCollection();open('Reliquias')});control.title=relics[id].description;control.setAttribute('aria-pressed',enabled);control.prepend(icon(relics[id].image??'relics/'+id+'.png'));return control})
  };
  // Reconstruye la página para reflejar inmediatamente la activación de reliquias.
  function open(name){listPage(name,lists[name],0,again)}
  const grid=element('section');grid.className='catalog-grid';
  for(const name of Object.keys(lists)){
    const entry=button(name,()=>open(name));grid.append(entry);
  }
  dialog.append(grid);
  dialog.append(button('Volver',back));
}

// Compra y saldo se escriben juntos. Las reliquias nuevas quedan activadas.
function shop(back) {
  const entries=Object.entries(relics).map(([id,relic])=>()=>{
    const card=button(relic.name,()=>{
      if(!game.collection.relics.includes(id))game.collection.relics.push(id);
      if(!game.collection.enabled.includes(id))game.collection.enabled.push(id);
      saveCollection();shop(back);
    });
    card.title=relic.description+' · '+(game.collection.enabled.includes(id)?'Activa':'Activar para probar');
    card.append(icon(relic.image??'relics/'+id+'.png'));return card;
  });
  listPage('Tienda de Aventureros',entries,0,back);
}

// Una acción destructiva o una importación requiere una segunda elección dentro del juego.
function confirmChange(message,accept,cancel) {
  const dialog=screen('Ajustes');
  dialog.append(element('p',message),button('Cancelar',cancel),button('Confirmar',accept));
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
    async function home(){if(!game.collection.intro)await introduction();const dialog=screen('Pommedew');dialog.append(button('Nueva Aventura',resolve),button('Tienda de Aventureros',()=>shop(home)),
      button('Colección',()=>collectionMenu(home)),button('Ajustes',()=>settings(home)))}
    home();
  });
}

// Conserva las dos ofertas generadas hasta que se selecciona una de ellas.
export function selectMission(offers) {
  return new Promise(resolve=>{
    const dialog=screen('Tablón de misiones'),grid=element('section');grid.className='offers contracts';grid.style.setProperty('--cards',offers.length);
    for(const mission of offers){
      const card=button('',()=>{dialog.close();resolve(mission)});if(mission.red){card.className='red';card.append(element('small','Papel rojo · +15 niveles'))}
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
