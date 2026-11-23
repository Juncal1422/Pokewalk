// Los PNG de interfaz pueden tener un fondo blanco opaco. Se limpia solamente
// el blanco conectado al centro o al borde para conservar los brillos del marco.
export async function loadMessageFrame(panel) {
  for (const name of ['textbox-g', 'textbox-b']) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = new URL('../../assets/ui/' + name + '.png', import.meta.url).href;
    try {
      await image.decode();
      const canvas = document.createElement('canvas');
      const w = canvas.width = image.width, h = canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, w, h);
      const rgba = pixels.data;
      const stack = [];
      function visit(i) {
        const p = i * 4;
        if (!rgba[p + 3] || Math.min(rgba[p], rgba[p + 1], rgba[p + 2]) < 250) return;
        rgba[p + 3] = 0;
        stack.push(i);
      }
      for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
      visit(Math.floor(h / 2) * w + Math.floor(w / 2));
      while (stack.length) {
        const i = stack.pop();
        if (i % w) visit(i - 1);
        if (i % w < w - 1) visit(i + 1);
        if (i >= w) visit(i - w);
        if (i < w * (h - 1)) visit(i + w);
      }
      ctx.putImageData(pixels, 0, 0);
      panel.style.borderImageSource = 'url("' + canvas.toDataURL() + '")';
      panel.style.borderImageSlice = String(Math.floor(Math.min(w, h) / 3));
      return;
    } catch (error) {
      console.debug('[Mensajes] Marco no disponible', name, error.message);
    }
  }
}
