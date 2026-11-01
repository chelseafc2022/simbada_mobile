// Aset tepercaya dibundel ke HTML agar WebView tidak memerlukan akses file://.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'../android/app/src/main/assets');
const script=source=>'<script>'+source.replace(/<\/script/gi,'<\\/script')+'</script>';
let html=fs.readFileSync(path.join(root,'offline_map.html'),'utf8');
let css=fs.readFileSync(path.join(root,'leaflet.css'),'utf8').replace(/url\(images\/([^\)]+)\)/g,(_,name)=>{
 const file=path.join(root,'images',name);return fs.existsSync(file)?'url(data:image/png;base64,'+fs.readFileSync(file).toString('base64')+')':'none';
});
html=html.replace('<link rel="stylesheet" href="leaflet.css"/>',()=>'<style>'+css+'</style>');
for(const name of ['leaflet.js','geotiff.js','pdf.min.js'])html=html.replace('<script src="'+name+'"></script>',()=>script(fs.readFileSync(path.join(root,name),'utf8')));
const worker=fs.readFileSync(path.join(root,'pdf.worker.min.js'),'utf8');
html=html.replace('<script src="pdf.worker.min.js"></script>','').replace("'pdf.worker.min.js'",()=> 'URL.createObjectURL(new Blob(['+JSON.stringify(worker).replace(/</g,'\\u003c')+'],{type:"text/javascript"}))');
html=html.replace(/\r\n?/g,'\n');
const nonce=crypto.randomBytes(24).toString('base64');
html=html.replace(/<script>([\s\S]*?)<\/script>/g,(_,code)=>'<script nonce="'+nonce+'" src="data:text/javascript;base64,'+Buffer.from(code).toString('base64')+'"></script>');
html=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' blob:; worker-src blob:; connect-src blob:; img-src data: blob: https://*.tile.openstreetmap.org; style-src 'unsafe-inline'; font-src data: blob:">`);
const target=path.join(__dirname,'../views/assets/offline-map.json');fs.writeFileSync(target,JSON.stringify({html}));
console.log('Offline map HTML mandiri disiapkan.');
