import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Listen for unhandled errors
    page.on('pageerror', error => {
        console.error('PAGE ERROR CAUGHT:', error.message);
        console.error('STACK:', error.stack);
        process.exit(1);
    });
    
    // Also catch console errors just in case
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('CONSOLE ERROR CAUGHT:', msg.text());
            if (msg.text().includes('TypeError')) {
                console.error('Found TypeError in console!');
                process.exit(1);
            }
        }
    });

    console.log('Navigating to app...');
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('nav');
    
    // Click on the second link in nav (assuming Producción is there based on typical layout)
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('nav button'));
        const prodBtn = buttons.find(b => b.textContent && b.textContent.includes('Producci'));
        if (prodBtn) {
            console.log('Found button, clicking...');
            prodBtn.click();
        } else {
            console.log('Button not found');
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await browser.close();
})();
