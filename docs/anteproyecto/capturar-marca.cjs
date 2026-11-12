const {chromium}=require('C:/Users/Vivobook Slim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
 for(const [name,width,height] of [['inicio-pc',1440,920],['inicio-movil',390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:3033/i3');await page.waitForTimeout(600);
  await page.screenshot({path:`docs/anteproyecto/reflection-assets/${name}.png`});
  if(name==='inicio-pc')await page.locator('.hero-arte').screenshot({path:'docs/anteproyecto/reflection-assets/hero-arte.png'});
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
