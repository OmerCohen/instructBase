const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const {chromium} = require('C:/Users/OmerCohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd();
const work = path.join(root, 'tmp/humanizer-review');
const out = path.join(work, 'rendered');
fs.mkdirSync(out, {recursive: true});
const report = JSON.parse(fs.readFileSync(path.join(work, 'edit-report.json'), 'utf8'));
const results = [];
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, args:['--allow-file-access-from-files','--enable-unsafe-swiftshader']});
  try {
    for (const item of report.filter(x => x.file.includes('guide-sources') || x.file.includes('technician-card'))) {
      const page = await browser.newPage();
      const src = path.join(root, item.file);
      const name = path.basename(src, '.html');
      await page.goto(pathToFileURL(src).href);
      await page.evaluate(() => document.fonts.ready);
      if (!process.argv.includes('--decks-only')) await page.pdf({path:path.join(out,name+'.pdf'), preferCSSPageSize:true, printBackground:true});
      results.push({file:item.file,kind:'pdf',output:name+'.pdf'});
      console.log('PDF',name);
      await page.close();
    }
    for (const item of report.filter(x => x.file.endsWith('-deck.html'))) {
      const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(pathToFileURL(path.join(root,item.file)).href);
      await page.evaluate(() => document.fonts.ready);
      const slides=page.locator('.slide');
      const count=await slides.count();
      const name=item.file.split('/')[0]+'-'+path.basename(item.file,'.html');
      const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});
      const overflow=[];
      for(let i=0;i<count;i++) {
        if(i>0) await page.keyboard.press('ArrowRight');
        const issues=await slides.nth(i).evaluate(s=>{
          const frame=s.getBoundingClientRect();
          return [...s.querySelectorAll('h1,h2,h3,p,li,td,.key,.subtitle')].filter(e=>{
            if(e.closest('aside')||e.closest('svg'))return false;
            const r=e.getBoundingClientRect();
            return r.width>0&&r.height>0&&(r.bottom>frame.bottom-20||r.right>frame.right+1||r.left<frame.left-1||e.scrollWidth>e.clientWidth+3||e.scrollHeight>e.clientHeight+3);
          }).map(e=>({text:e.textContent.trim().slice(0,140),rect:e.getBoundingClientRect().toJSON()}));
        });
        if(issues.length)overflow.push({slide:i+1,issues});
        await page.screenshot({path:path.join(dir,String(i+1).padStart(2,'0')+'.png'),animations:'disabled'});
      }
      results.push({file:item.file,kind:'deck',count,errors,overflow,output:name});
      console.log('DECK',name,count,'slides,',errors.length,'errors,',overflow.length,'slides to inspect');
      await page.close();
    }
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.screenshot({path:path.join(out,'index.png'),fullPage:true});
    await page.close();
  } finally {
    fs.writeFileSync(path.join(work,'render-report.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
