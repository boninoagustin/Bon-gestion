import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    console.log('Navigating to app...');
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('nav');
    
    // Screenshot before click
    await page.screenshot({ path: 'before_click.png' });
    
    // Evaluate and click
    const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('nav button, nav a, button, a'));
        const prodBtn = buttons.find(b => b.textContent && b.textContent.includes('Producci'));
        if (prodBtn) {
            prodBtn.click();
            return true;
        }
        return false;
    });

    console.log('Clicked?', clicked);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Screenshot after click
    await page.screenshot({ path: 'after_click.png' });

    await browser.close();
})();
