const puppeteer = require('puppeteer');

async function testEmployeeDetailPage() {
  console.log('\n🔍 TEST EMPLOYEE DETAIL PAGE (ID 166)\n');
  console.log('='.repeat(50));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    // Step 1: Login first
    console.log('\n1️⃣ Login con utente Nexa Data...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

    // Use quick login for Giulia Verdi
    const quickLoginButtons = await page.$$('button[type="button"]');
    let loginSuccess = false;

    for (const button of quickLoginButtons) {
      const text = await button.evaluate(el => el.textContent);
      if (text.includes('Giulia Verdi')) {
        await button.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        loginSuccess = true;
        console.log('✅ Login completato');
        break;
      }
    }

    if (!loginSuccess) {
      console.log('❌ Login fallito - quick login button non trovato');
      await browser.close();
      return;
    }

    // Step 2: Navigate to employee detail page
    console.log('\n2️⃣ Navigazione a employee/166...');
    await page.goto('http://localhost:5173/employee/166', { waitUntil: 'networkidle0' });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Step 3: Check if page loaded correctly
    const currentUrl = page.url();
    console.log('URL corrente:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('❌ Redirectato a login - autenticazione persa');
      await browser.close();
      return;
    }

    // Step 4: Check for employee data
    const hasEmployeeName = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 && h1.textContent.includes('Christian Abd El Messih');
    });

    if (hasEmployeeName) {
      console.log('✅ Nome dipendente visualizzato correttamente');
    } else {
      console.log('❌ Nome dipendente non trovato');
    }

    // Step 5: Check for employee email
    const hasEmail = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => el.textContent.includes('cabdelmessih@nexadata.it'));
    });

    if (hasEmail) {
      console.log('✅ Email dipendente visualizzata');
    } else {
      console.log('❌ Email dipendente non trovata');
    }

    // Step 6: Check for ID
    const hasId = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => el.textContent.includes('#166'));
    });

    if (hasId) {
      console.log('✅ ID dipendente visualizzato');
    } else {
      console.log('❌ ID dipendente non trovato');
    }

    // Step 7: Check for error messages
    const hasError = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => el.textContent.toLowerCase().includes('errore'));
    });

    if (hasError) {
      console.log('⚠️ Messaggio di errore presente nella pagina');
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'employee-detail-166.png', fullPage: true });
    console.log('\n📸 Screenshot salvato: employee-detail-166.png');

  } catch (error) {
    console.error('❌ Errore durante test:', error);
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST COMPLETATO');
}

// Run test
testEmployeeDetailPage().catch(console.error);