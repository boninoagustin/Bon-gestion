const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    let hasError = false;
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
            hasError = true;
        }
    });
    
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.toString());
        console.log('STACK TRACE:', err.stack);
        hasError = true;
    });

    try {
        await page.goto('http://localhost:5173');
        await page.waitForSelector('nav');
        await new Promise(r => setTimeout(r, 1000));
        
        console.log('Attempting to click Producción...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('button'));
            const prodBtn = tabs.find(b => b.textContent && b.textContent.includes('Producción'));
            if (prodBtn) {
                console.log('Found btn, clicking...');
                prodBtn.click();
            } else {
                console.log('Producción button not found');
            }
        });
        
        await new Promise(r => setTimeout(r, 2000));
        
        if (!hasError) {
            console.log('No error detected yet, trying to click around in Production...');
            await page.evaluate(() => {
                const btn = document.querySelector('.bg-copper');
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("Done checking");
    } catch (e) {
        console.log('SCRIPT ERROR:', e);
    } finally {
        await browser.close();
    }
})();
