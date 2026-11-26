// Orden físico de las columnas compartido por todos los biomas.
const columns = ["legend", "wall", "wallAlt", "wallAlt", "wallAlt", "wallAlt", "floor", "floorAlt", "floorAlt", "unused", "unused", "waterBase", "water", "waterAlt", "lava", "void", "voidAlt", "voidAlt"];
// Orden de las ocho muestras de la leyenda: N, NE, E, SE, S, SO, O, NO.
const neighbors = [[12,4],[20,4],[20,12],[20,20],[12,20],[4,20],[4,12],[4,4]];
const tileSize = 24;
const templateKeys = new Set([0x008080, 0xff00ff, 0x00ff00]);

// Un brillo puede ocupar sólo unas pocas piezas. Ignora los separadores de la plantilla.
function hasArtwork(column, top, colorAt) {
  for (let cell = 0; cell < 72; cell++) {
    const x = 9 + column * 75 + (cell % 3) * 25;
    const y = top + Math.floor(cell / 3) * 25;
    for (let dy = 0; dy < tileSize; dy++) {
      for (let dx = 0; dx < tileSize; dx++) {
        if (!templateKeys.has(colorAt(x + dx, y + dy))) return true;
      }
    }
  }
  return false;
}

// Lee los bancos de 16 colores; cada fila sucesiva es una fase de animación.
function readPalettes(colorAt, x, width, height) {
  const banks = [];
  if (x + 176 >= width) return banks;
  const isRule = y => y < height && colorAt(x,y) === 0xf0f0f0 &&
    Array.from({length:176}, (_,i)=>colorAt(x+i,y)).every(color=>color===0xf0f0f0);
  for (let y=0; y+11<height; y++) {
    if (!isRule(y) || !isRule(y+11)) continue;
    const rows = [];
    while (isRule(y+11)) {
      rows.push(Array.from({length:16}, (_,i)=>colorAt(x+5+i*11,y+5)));
      y += 11;
    }
    banks.push(rows);
  }
  return banks;
}

// Compila las 47 conexiones directamente de la leyenda, sin archivos blob derivados en el repositorio.
export async function loadTileset(biome) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = biome.tileset;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  context.drawImage(image,0,0);
  const source = context.getImageData(0,0,image.width,image.height).data;
  const colorAt = (x,y) => {
    const i = (y*image.width+x)*4;
    return source[i]*65536+source[i+1]*256+source[i+2];
  };
  const top = image.height - 607;
  const banks = readPalettes(colorAt,16+75*columns.length,image.width,image.height);
  const sparkleColumn=columns.indexOf('waterAlt');
  const hasSparkles = hasArtwork(sparkleColumn, top, colorAt);
  const tiles = new Map();
  const choices = new Map();
  for (let cell=0; cell<72; cell++) {
    const x = 9+25*(cell%3), y = top+25*Math.floor(cell/3);
    const center=colorAt(x+12,y+12);
    if ((center & 0xf0f0f0)!==0xf0f0f0) continue;
    const mask = neighbors.reduce((bits,[dx,dy],i)=>bits | ((colorAt(x+dx,y+dy) & 0xf8f8f8)===0 ? 1<<i : 0),0);
    const layers = {};
    for (const [column,role] of columns.entries()) {
      if (role==='legend' || role==='unused') continue;
      // Extrae las filas de la copia del atlas. Leer el canvas por cada pieza sincronizaba la GPU.
      const pixels = new Uint8ClampedArray(tileSize*tileSize*4);
      for(let row=0;row<tileSize;row++){
        const start=((y+row)*image.width+x+75*column)*4;
        pixels.set(source.subarray(start,start+tileSize*4),row*tileSize*4);
      }
      const data = {data:pixels};
      const colors = new Set();
      for(let i=0;i<data.data.length;i+=4){
        const rgb=data.data[i]*65536+data.data[i+1]*256+data.data[i+2];
        if(templateKeys.has(rgb)) data.data[i+3]=0;
        else if(data.data[i+3]) colors.add(rgb);
      }
      if(!colors.size)continue;
      const paletteBanks=role==='waterAlt' ? banks.slice(-1) :
        role==='water' && banks.length>1 && hasSparkles ? banks.slice(0,-1) : banks;
      const tile=makeTile(data,colors,paletteBanks);
      (layers[role]??=[]).push(tile);
      if(role==='floor' || role==='floorAlt')choices.set(data.data.join(','),tile);
    }
    tiles.set(mask,layers);
  }
  if(tiles.size!==47) throw Error('Leyenda de autotiles inválida: '+biome.name);
  tiles.animated=banks.some(bank=>bank.length>1);
  tiles.floorChoices=[...choices.values()];
  return tiles;
}

// Elige el banco por coincidencia con la paleta original. Cada fase se rasteriza una sola vez por pieza.
function makeTile(original, colors, banks) {
  let palette, best=0;
  for(const bank of banks){
    const score=new Set(bank[0].filter(color=>colors.has(color))).size;
    if(score>best){best=score;palette=bank;}
  }
  const frames=[];
  return phase=>{
    const index=palette ? phase%palette.length : 0;
    if(frames[index]) return frames[index];
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=tileSize;
    const pixels=new ImageData(new Uint8ClampedArray(original.data),tileSize,tileSize);
    if(index){
      const replacements=new Map(palette[0].map((color,i)=>[color,palette[index][i]]));
      for(let i=0;i<pixels.data.length;i+=4){
        const rgb=pixels.data[i]*65536+pixels.data[i+1]*256+pixels.data[i+2];
        const next=replacements.get(rgb);
        if(next===undefined)continue;
        if(next===0xff00ff || next===0x00ff00){pixels.data[i+3]=0;continue;}
        pixels.data[i]=next>>16; pixels.data[i+1]=(next>>8)&255; pixels.data[i+2]=next&255;
      }
    }
    canvas.getContext('2d').putImageData(pixels,0,0);
    return frames[index]=canvas;
  };
}

// Suelo, borde del material y alternativa comparten máscara y fase; el vacío de una alternativa deja ver la base.
export function drawTerrainTile(ctx, tiles, mask, material, variant, phase, x, y, size, sparklePhase=phase) {
  const layers=tiles.get(mask);
  const paint=tile=>{if(tile)ctx.drawImage(tile(phase),x,y,size,size);};
  if(material==='floor'){paint(tiles.floorChoices[variant % tiles.floorChoices.length]);return;}
  paint(tiles.get(255).floor?.[0]);
  if(material==='water')paint(layers.waterBase?.[0]);
  paint(layers[material]?.[0] ?? layers.void?.[0]);
  const alternatives=layers[material+'Alt'];
  if(material==='water' && alternatives?.length)ctx.drawImage(alternatives[0](sparklePhase),x,y,size,size);
  else if(variant && alternatives?.length)paint(alternatives[(variant-1)%alternatives.length]);
}
