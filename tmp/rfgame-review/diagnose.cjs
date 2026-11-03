const {chromium}=require('C:/Users/OmerCohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');const path=require('path');
const out=__dirname;
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const p=await b.newPage({viewport:{width:393,height:628},isMobile:true,hasTouch:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*overpass*',r=>r.fulfill({status:503,body:''}));
  await p.goto('http://127.0.0.1:5178/?region=galil-west');
  await p.evaluate(async()=>{
   const [{default:L},{ElevationService},{RfEngine},{PvpController}]=await Promise.all([import('/node_modules/.vite/deps/leaflet.js'),import('/src/engine/elevation.ts'),import('/src/engine/rf.ts'),import('/src/ui/pvp/controller.ts')]);
   L.Map.addInitHook(function(){window.qaMap=this;});window.qaLeaflet=L;
   const elev=new ElevationService();await elev.loadData();
   document.body.dataset.rfScreen='pvp';const root=document.createElement('div');root.style.cssText='position:fixed;inset:0';document.body.replaceChildren(root);
   window.qaController=new PvpController(root,{elev,rf:new RfEngine(elev),onExit(){}});window.qaController.mount();
  });
  await p.locator('[data-pvp-entry="solo"]').click();
  await p.locator('[data-pvp-setup="continue"]').click();
  await p.waitForSelector('.pvp-force-fab',{timeout:90000});
  if(await p.locator('[data-guide-skip]').count())await p.locator('[data-guide-skip]').click();
  await p.locator('[data-force-fab="p1:patrol"]').click();
  await p.screenshot({path:path.join(out,'arena-before.png')});
  console.log('INITIAL',await p.evaluate(()=>({height:innerHeight,bar:document.querySelector('#pvp-actions-host')?.getBoundingClientRect().toJSON(),buttons:[...document.querySelectorAll('#pvp-actions-host button')].map(e=>e.textContent),markers:[...document.querySelectorAll('.leaflet-marker-icon')].slice(0,8).map(e=>({cls:e.className,attrs:[...e.attributes].map(a=>[a.name,a.value]),html:e.innerHTML.slice(0,220)}))})));
  await p.evaluate(()=>{
   window.qaMutations=[];
   new MutationObserver(records=>{for(const r of records){if(r.target.closest?.('#pvp-actions-host,.leaflet-marker-pane,.pvp-force-fabs'))window.qaMutations.push({at:Math.round(performance.now()),type:r.type,attr:r.attributeName,cls:r.target.className,added:r.addedNodes.length,removed:r.removedNodes.length});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
   const map=window.qaMap,center=map.getCenter();map.fire('click',{latlng:window.qaLeaflet.latLng(center.lat+.004,center.lng+.004),containerPoint:map.latLngToContainerPoint([center.lat+.004,center.lng+.004]),originalEvent:new MouseEvent('click')});
  });
  await p.waitForTimeout(15000);
  const result=await p.evaluate(()=>({mutations:window.qaMutations,barHeight:document.querySelector('#pvp-actions-host')?.getBoundingClientRect().height,text:document.body.innerText.slice(-1800)}));
  fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify({errors,...result},null,2));
  await p.screenshot({path:path.join(out,'arena-motion.png')});
  console.log('RESULT',JSON.stringify({errors,barHeight:result.barHeight,mutationCount:result.mutations.length,mutations:result.mutations.slice(0,30),text:result.text}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
