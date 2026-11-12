const {chromium}=require('C:/Users/Vivobook Slim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:390,height:920},deviceScaleFactor:1,reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:3033/i3/contacto');
 await page.waitForTimeout(600);
 const aviso=page.locator('.formulario-layout aside .alerta').filter({hasText:'Vista de interfaz'});
 if(await aviso.count()!==1)throw new Error('No se encontró el aviso exacto');
 await aviso.evaluate(el=>el.remove());
 await page.screenshot({path:'docs/anteproyecto/reflection-assets/contacto-movil.png'});
 await browser.close();
})();
