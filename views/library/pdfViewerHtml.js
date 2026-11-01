const viewer = require('../assets/pdfjs/viewer.json');
const literal = value => JSON.stringify(value).replace(/</g, '\\u003c');
export function pdfViewerHtml(base64) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src blob:; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; connect-src 'none'">
<style>body{margin:0;font-family:sans-serif;background:#eee}header{position:sticky;top:0;background:white;padding:10px;display:flex;justify-content:space-between}canvas{display:block;margin:12px auto;max-width:100%}#error{padding:20px;color:#b00}</style></head><body>
<header><button id="prev">Sebelumnya</button><span id="page">Memuat PDF…</span><button id="next">Berikutnya</button></header><div id="error"></div><canvas id="canvas"></canvas>
<script type="module">
try {
if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}};
const blobUrl = text => URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
const runtimeUrl=blobUrl(${literal(viewer.runtime)}),workerUrl=blobUrl(${literal(viewer.worker)});
const pdfjs=await import(runtimeUrl);pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
const resources=${literal(viewer.resources)};
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
class BinaryDataFactory {async fetch({kind,filename}){const data=resources[kind]?.[filename];if(!data)throw new Error('Resource PDF tidak tersedia');return bytes(data)}}
const pdf=await pdfjs.getDocument({data:bytes(${literal(base64)}),BinaryDataFactory,useWorkerFetch:false,isEvalSupported:false,enableScripting:false,isOffscreenCanvasSupported:false,isImageDecoderSupported:false,useSystemFonts:true,maxImageSize:16777216,canvasMaxAreaInBytes:16777216}).promise;
let page=1,busy=false;const canvas=document.getElementById('canvas');
async function render(){if(busy)return;busy=true;try{const p=await pdf.getPage(page),v=p.getViewport({scale:1}),scale=Math.min((innerWidth-24)/v.width,1800/v.width,2400/v.height);const viewport=p.getViewport({scale});canvas.width=viewport.width;canvas.height=viewport.height;document.getElementById('page').textContent=page+' / '+pdf.numPages;await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;}finally{busy=false}}
document.getElementById('prev').onclick=()=>{if(!busy&&page>1){page--;render().catch(showError)}};
document.getElementById('next').onclick=()=>{if(!busy&&page<pdf.numPages){page++;render().catch(showError)}};
await render();
}catch(error){showError(error)}
function showError(error){document.getElementById('error').textContent='PDF tidak dapat ditampilkan.';window.ReactNativeWebView?.postMessage(JSON.stringify({error:'PDF_RENDER_FAILED'}))}
</script></body></html>`;
}
