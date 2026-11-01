// Smoke/regresi pada HTML yang sama dengan sumber WebView; memakai Chrome terisolasi.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
function syntheticPdf() {
 const stream='BT /F1 18 Tf 40 200 Td (SIMBADA PDF TEST) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);return pdf+`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}
function syntheticTiff() {
 const tags=[[256,4,1,2],[257,4,1,2],[258,3,1,8],[259,3,1,1],[262,3,1,1],[273,4,1,0],[277,3,1,1],[278,4,1,2],[279,4,1,4],[33550,12,3,0],[33922,12,6,0]];
 const extra=8+2+tags.length*12+4,pixels=extra+72,b=Buffer.alloc(pixels+4);b.write('II');b.writeUInt16LE(42,2);b.writeUInt32LE(8,4);b.writeUInt16LE(tags.length,8);tags[5][3]=pixels;tags[9][3]=extra;tags[10][3]=extra+24;
 tags.forEach((t,i)=>{const o=10+i*12;b.writeUInt16LE(t[0],o);b.writeUInt16LE(t[1],o+2);b.writeUInt32LE(t[2],o+4);b.writeUInt32LE(t[3],o+8);});[0.01,0.01,0,0,0,0,122,-4,0].forEach((x,i)=>b.writeDoubleLE(x,extra+i*8));b.fill(128,pixels);return b.toString('base64');
}
const dir=fs.mkdtempSync('/tmp/simbada-offline-regression-'),profile=dir+'/browser';fs.mkdirSync(profile);
fs.writeFileSync(dir+'/map.html',require('../views/assets/offline-map.json').html);
const child=cp.spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+profile,'--host-resolver-rules=MAP * 0.0.0.0','file://'+dir+'/map.html'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;
(async()=>{let port;for(let i=0;i<100;i++){if(fs.existsSync(profile+'/DevToolsActivePort')){port=fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0];break;}await delay(100);}assert.ok(port);
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown'){console.log(JSON.stringify(m.params.exceptionDetails).slice(0,1000));}else if(m.method==='Log.entryAdded'){console.log(m.params.entry.text.slice(0,500));}};
 const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,m=>m.result?.exceptionDetails?reject(new Error(m.result.exceptionDetails.text+': '+m.result.exceptionDetails.exception?.description)):resolve(m.result?.result?.value));ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});
 ws.send(JSON.stringify({id:++seq,method:'Runtime.enable'}));ws.send(JSON.stringify({id:++seq,method:'Log.enable'}));
 for(let i=0;i<40;i++){if(await evaluate("typeof loadLayers==='function'"))break;await delay(100);}
 const evil='<img src=x onerror="window.__probe=true">';
 const layer={type:'polygon',visible:true,name:evil,notes:evil,coordinates:[{lat:-4,lon:122},{lat:-4.01,lon:122},{lat:-4,lon:122.01}],areaM2:123};
 await evaluate(`loadLayers(${JSON.stringify([layer])});savedLayersGroup.eachLayer(l=>l.openPopup());`);await delay(200);
 const result=await evaluate(`({executed:!!window.__probe,images:document.querySelector('.leaflet-popup-content').querySelectorAll('img').length,text:document.querySelector('.leaflet-popup-content').textContent})`);
 assert.equal(result.executed,false);assert.equal(result.images,0);assert.ok(result.text.includes(evil));
 const navigated=await evaluate(`document.querySelector('.leaflet-popup-content button').click();!!navTarget`);assert.equal(navigated,true);
 await evaluate(`loadLayers([{type:'polyline',visible:true,name:'invalid',coordinates:[{lat:'0);alert(1)',lon:122},{lat:-4,lon:122}]}]);`);
 assert.equal(await evaluate('savedLayersGroup.getLayers().length'),0);
 const pdf=syntheticPdf()+'\n% /GPTS [-4 122 -4.01 122 -4.01 122.01 -4 122.01]\n';
 await evaluate(`loadGeoPDF(${JSON.stringify(Buffer.from(pdf,'binary').toString('base64'))},'Fixture GeoPDF')`);
 let status;for(let i=0;i<40;i++){status=await evaluate("document.getElementById('status').textContent");if(status.startsWith('Peta:')||status.startsWith('Error:'))break;await delay(250);}assert.equal(status,'Peta: Fixture GeoPDF');
 await evaluate(`loadGeoTIFF(${JSON.stringify(syntheticTiff())},'Fixture GeoTIFF')`);
 for(let i=0;i<40;i++){status=await evaluate("document.getElementById('status').textContent");if(status.startsWith('Peta:')||status.startsWith('Error:'))break;await delay(250);}assert.equal(status,'Peta: Fixture GeoTIFF');
 console.log(JSON.stringify({geoTiff:true,xssBlocked:true,textPreserved:true,navigation:true,invalidCoordinatesRejected:true,geoPdf:true,result:'PASS'}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{ws?.close();child.kill('SIGTERM');});
