// Reuses installed Edge and Node's native WebSocket: no test framework installation.
// Only the explicitly started COMB6_ISOLATED API and a dedicated browser profile are accepted.
const {spawn}=require('node:child_process');
const {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,existsSync}=require('node:fs');
const {resolve,join,sep}=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const assert=require('node:assert/strict');

async function main(){
  const root=resolve('node_modules/.cache');mkdirSync(root,{recursive:true});
  const profile=mkdtempSync(join(root,'comb6-edge-'));
  const ready=JSON.parse(readFileSync(resolve('../backend-nest/node_modules/.cache/comb6-browser-ready.json'),'utf8'));
  const api=`http://127.0.0.1:${ready.port}`;
  const origin='http://127.0.0.1:4300';
  const status=await (await fetch(`${api}/__comb6/status`)).json();
  assert.equal(status.fixture,'COMB6_ISOLATED');assert.equal(status.pid,ready.pid);
  const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
    '--headless=new','--no-first-run','--disable-extensions','--disable-background-networking',
    '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
  ],{windowsHide:true,stdio:'ignore'});
  let ws;let stage='browser startup';
  const evidence={environment:'Real Next production bundle + real Nest HTTP/JWT + disposable PostgreSQL; Edge mobile emulation and synthetic GPS via CDP; Redis-boundary model, NOT real shared Redis',executedAt:new Date().toISOString(),status:'failed',checks:{},requests:[]};
  let authorization=null;let sessionId;let number=0;const pending=new Map();
  const send=(method,params={},session=sessionId)=>new Promise((accept,reject)=>{
    const id=++number;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('CDP_TIMEOUT'));},15000);
    pending.set(id,{accept,reject,timeout});ws.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));
  });
  const evaluate=async(expression)=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error('BROWSER_EVALUATION_FAILED');
    return result.result.value;
  };
  const wait=async(expression)=>{
    for(let n=0;n<120;n++){if(await evaluate(expression))return;await delay(250);}
    throw new Error('UI_TIMEOUT');
  };
  const click=async(expression)=>{
    const point=await evaluate(`(()=>{const e=${expression};if(!e || e.disabled)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    assert.ok(point);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  };
  try{
    for(let n=0;n<100 && !existsSync(join(profile,'DevToolsActivePort'));n++)await delay(100);
    const [port,path]=readFileSync(join(profile,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);
    ws=new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.onmessage=async({data})=>{
      const message=JSON.parse(String(data));
      if(message.id){const p=pending.get(message.id);if(!p)return;clearTimeout(p.timeout);pending.delete(message.id);if(message.error)p.reject(new Error('CDP_COMMAND_FAILED'));else p.accept(message.result);return;}
      try{
        if(message.method==='Fetch.requestPaused'){
          const u=new URL(message.params.request.url);
          const allowed=u.hostname==='127.0.0.1' && [String(ready.port),'4300'].includes(u.port);
          await send(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:message.params.requestId,...(!allowed?{errorReason:'BlockedByClient'}:{})});
        }
        if(message.method==='Network.requestWillBeSent'){
          const r=message.params.request;const u=new URL(r.url);
          if(u.origin===api && u.pathname.startsWith('/api/')){
            let fields=[];try{fields=Object.keys(JSON.parse(r.postData??'{}'));}catch{}
            evidence.requests.push({path:u.pathname.replace(/\/sessions\/\d+/,'/sessions/:id'),method:r.method,fields});
          }
        }
        if(message.method==='Network.responseReceived' && new URL(message.params.response.url).pathname.endsWith('/combined-challenge')){
          // Wait for loadingFinished before reading the body; authorization is held only in process memory.
          challengeResponses.add(message.params.requestId);
        }
        if(message.method==='Network.loadingFinished' && challengeResponses.delete(message.params.requestId)){
          const body=await send('Network.getResponseBody',{requestId:message.params.requestId});
          authorization=JSON.parse(body.body).data.authorization;
        }
      }catch{ /* Explicit assertions below determine the test outcome; never dump a network body. */ }
    };
    const challengeResponses=new Set();
    await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=()=>no(new Error('CDP_UNAVAILABLE'));});
    const target=await send('Target.createTarget',{url:'about:blank'},null);
    sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    await send('Browser.grantPermissions',{origin,permissions:['geolocation']},null);
    await send('Emulation.setGeolocationOverride',{latitude:-19.57,longitude:-65.75,accuracy:10});
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__comb6GpsCalls=0;const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=(...args)=>{window.__comb6GpsCalls++;return original(...args);};`});
    stage='QR login handoff';await send('Page.navigate',{url:`${api}/__comb6/scan`});
    await wait(`!!document.querySelector('a')`);await click(`document.querySelector('a')`);
    await wait(`location.pathname==='/login' && !!document.querySelector('#username')`);
    assert.equal(await evaluate('location.search'),'');
    await delay(36000); // Real QR expiry during the actual login UI; never extend the original token.
    stage='real login';
    await send('DOM.enable');
    for(const [selector,value]of [['#username','comb6-2'],['#password','synthetic-comb6-fixture-password']]){
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      await send('Input.insertText',{text:value});
    }
    await click(`document.querySelector('button[type=submit]')`);
    await wait(`location.pathname==='/attendance/qr' && document.body.textContent.includes('El código QR caducó')`);
    evidence.checks.realLogin=true;evidence.checks.safeLoginReturn=true;
    assert.equal(await evaluate('window.__comb6GpsCalls'),0);
    assert.equal(evidence.requests.filter(r=>r.path.endsWith('/combined-challenge')).length,0);
    evidence.checks.expiredQrDuringLoginWithoutGpsOrChallenge=true;
    stage='scan and discovery';await send('Page.navigate',{url:`${api}/__comb6/scan`});
    await wait(`!!document.querySelector('a')`);await click(`document.querySelector('a')`);
    const locationButton=`[...document.querySelectorAll('button')].find(e=>e.textContent==='Obtener mi ubicación')`;
    const confirmButton=`[...document.querySelectorAll('button')].find(e=>e.textContent==='Confirmar asistencia')`;
    await wait(`!!(${locationButton})`);
    assert.equal(await evaluate('location.hash'),'');
    assert.equal(await evaluate('window.__comb6GpsCalls'),0);
    assert.equal(evidence.requests.filter(r=>r.path.endsWith('/combined-check-in')).length,0);
    evidence.checks.noSilentGpsOrCheckIn=true;
    assert.equal((await (await fetch(`${api}/__comb6/status`)).json()).marks,0);
    stage='explicit GPS';await click(locationButton);await wait(`!!(${confirmButton})`);
    assert.equal(await evaluate('window.__comb6GpsCalls'),1);
    assert.equal(evidence.requests.filter(r=>r.path.endsWith('/combined-check-in')).length,0);
    assert.equal((await (await fetch(`${api}/__comb6/status`)).json()).marks,0);
    assert.ok(authorization);
    const safe=await evaluate(`(()=>{const secret=${JSON.stringify(authorization)};const values=[...Object.values(localStorage),...Object.values(sessionStorage),document.cookie];return {authorization:values.every(v=>!v.includes(secret)),location:values.every(v=>!/(latitude|longitude|accuracy)/.test(v))};})()`);
    assert.equal(safe.authorization,true);assert.equal(safe.location,true);evidence.checks.storageClean=true;
    stage='explicit confirmation';await click(confirmButton);
    await wait(`document.body.textContent.includes('Asistencia registrada correctamente')`);
    assert.equal(evidence.requests.filter(r=>r.path.endsWith('/combined-check-in')).length,1);
    assert.equal(await evaluate(`!!(${confirmButton})`),false);
    assert.equal((await (await fetch(`${api}/__comb6/status`)).json()).marks,1);
    evidence.checks.oneConfirmedAttendance=true;
    assert.ok(await evaluate(`document.body.textContent.includes('QR + ubicación')`));
    authorization=null;
    const output=resolve('../../docs/attendance-comb-6');mkdirSync(output,{recursive:true});
    writeFileSync(join(output,'student-browser.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    evidence.status='passed';
  }finally{
    authorization=null;
    evidence.stage=stage;
    const output=resolve('../../docs/attendance-comb-6');mkdirSync(output,{recursive:true});
    writeFileSync(join(output,'browser-results.json'),JSON.stringify(evidence,null,2)+'\n');
    try{await fetch(`${api}/__comb6/finish`,{method:'POST'});}catch{}
    try{if(ws?.readyState===1)await send('Browser.close',{},null);}catch{}
    ws?.close();edge.kill();
    await delay(1000);
    if(profile.startsWith(root+sep) && profile.includes('comb6-edge-'))try{rmSync(profile,{recursive:true,force:true});}catch{}
  }
  console.log(JSON.stringify({status:evidence.status,checks:evidence.checks,requests:evidence.requests.length}));
}
main().catch(()=>{console.error('COMB6 browser integration failed; see sanitized browser-results.json');process.exitCode=1;});
