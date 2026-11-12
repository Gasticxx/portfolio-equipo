const {chromium}=require('C:/Users/Vivobook Slim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('docs/anteproyecto/reflection-assets',{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
 for(const [name,url,width,height] of [['inicio-pc','',1440,920],['inicio-movil','',390,844],['proyectos-pc','/proyectos',1440,920],['contacto-movil','/contacto',390,920],['componentes-pc','/componentes',1440,1000]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce',bypassCSP:true});
 await page.goto('http://127.0.0.1:3033/i3'+url); await page.waitForTimeout(600);
 console.log(name,await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})));
 await page.screenshot({path:path.resolve('docs/anteproyecto/reflection-assets/'+name+'.png')});
 if(name==='inicio-pc') {
   await page.locator('.hero-arte').screenshot({path:path.resolve('docs/anteproyecto/reflection-assets/hero-arte.png')});
   await page.addStyleTag({content:'header,main,footer,.control-movimiento,.cursor-cristal,.astro {visibility:hidden!important} body {height:920px!important;overflow:hidden!important}'});
   await page.screenshot({path:path.resolve('docs/anteproyecto/reflection-assets/fondo.png')});
 }
 await page.close();
 } await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
