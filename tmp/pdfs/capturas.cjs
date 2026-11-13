const {chromium}=require('C:/Users/Vivobook Slim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
 for(const [name,url,width,height] of [['inicio-pc','',1440,1000],['inicio-movil','',390,844],['proyectos-pc','/proyectos',1440,1000],['contacto-movil','/contacto',390,1000],['componentes-pc','/componentes',1440,1100]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:3033/i3'+url); await page.waitForTimeout(700);
 await page.screenshot({path:path.resolve('docs/anteproyecto/assets/'+name+'.png')}); await page.close();
 } await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
