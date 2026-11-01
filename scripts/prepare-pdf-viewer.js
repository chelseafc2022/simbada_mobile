const fs = require('fs');
const path = require('path');
const source = path.dirname(require.resolve('pdfjs-dist/package.json'));
const target = path.join(__dirname,'../views/assets/pdfjs');
fs.mkdirSync(target,{recursive:true});
const read = file => fs.readFileSync(path.join(source,file),'utf8');
const resources = {};
for (const [kind,dir] of [['wasmUrl','wasm'],['standardFontDataUrl','standard_fonts'],['cMapUrl','cmaps']]) {
    resources[kind] = {};
    for (const name of fs.readdirSync(path.join(source,dir))) {
        const file=path.join(source,dir,name);
        if (fs.statSync(file).isFile() && !name.toLowerCase().includes('license')) resources[kind][name]=fs.readFileSync(file).toString('base64');
    }
}
fs.writeFileSync(path.join(target,'viewer.json'),JSON.stringify({version:require('pdfjs-dist/package.json').version,
    runtime:read('legacy/build/pdf.mjs'),worker:read('legacy/build/pdf.worker.mjs'),resources}));
fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'LICENSE'));
const licenses=path.join(target,'licenses');fs.mkdirSync(licenses,{recursive:true});
for(const dir of ['wasm','standard_fonts','cmaps']) for(const name of fs.readdirSync(path.join(source,dir))) {
  if(name.toLowerCase().includes('license')) fs.copyFileSync(path.join(source,dir,name),path.join(licenses,dir+'-'+name));
}
console.log('Viewer PDF lokal diperbarui dari pdfjs-dist '+require('pdfjs-dist/package.json').version);
