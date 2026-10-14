const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
        }
    });
    
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.toString());
        console.log('STACK TRACE:', err.stack);
    });

    try {
        await page.goto('http://localhost:5173');
        await page.waitForSelector('button');
        
        // Find and click "Producción"
        const buttons = await page.$$('button');
        let prodBtn = null;
        for (let btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Producción')) {
                prodBtn = btn;
                break;
            }
        }
        
        if (prodBtn) {
            await prodBtn.click();
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log('Production button not found');
        }
    } catch (e) {
        console.log('SCRIPT ERROR:', e);
    } finally {
        await browser.close();
    }
})();
