/**
 * Standalone test script for CARE portal scraping.
 * Tests session handshake, property search, and lien data parsing
 * without touching the database.
 *
 * Usage: npx tsx scripts/test-care-scraper.ts [bbl]
 * Default BBL: 3004050058 (expected: $58,334.65 to Tower)
 */

import * as cheerio from 'cheerio';

const CARE_BASE = 'https://a836-pts-access.nyc.gov/care';

const SERVICER_MAP: Record<string, string> = {
  'TOWER CAPITAL MANAGEMENT LLC': 'Tower',
  'TOWER CAPITAL MANAGEMENT': 'Tower',
  TOWER: 'Tower',
  'MOORING TAX ASSET GROUP LLC': 'MTAG',
  'MOORING TAX ASSET GROUP': 'MTAG',
  MTAG: 'MTAG',
};

function normalizeServicer(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return SERVICER_MAP[upper] || raw.trim();
}

class CookieJar {
  private cookies = new Map<string, string>();

  update(response: Response): void {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const header of setCookies) {
      const match = header.match(/^([^=]+)=([^;]*)/);
      if (match) {
        this.cookies.set(match[1], match[2]);
      }
    }
  }

  toString(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function parseAspNetFormFields(html: string) {
  const $ = cheerio.load(html);
  return {
    viewState: ($('#__VIEWSTATE').val() as string) || '',
    eventValidation: ($('#__EVENTVALIDATION').val() as string) || '',
    viewStateGenerator: ($('#__VIEWSTATEGENERATOR').val() as string) || '',
  };
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit & { redirect?: RequestRedirect },
  retries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status >= 300 && response.status < 400) return response;
      if (response.status >= 500 && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`  [retry] ${response.status} — waiting ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(
          `  [retry] ${(err as Error).message} — waiting ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Exhausted retries for ${url}`);
}

async function initSession(): Promise<{
  cookies: CookieJar;
  viewState: string;
  eventValidation: string;
  viewStateGenerator: string;
}> {
  const cookies = new CookieJar();
  console.log('\n1. GET search page (expect redirect to disclaimer)...');

  const step1 = await fetchWithRetry(
    `${CARE_BASE}/search/commonsearch.aspx?mode=persprop`,
    { redirect: 'manual' },
  );
  cookies.update(step1);
  console.log(`   Status: ${step1.status}`);
  console.log(`   Location: ${step1.headers.get('location') || '(none)'}`);
  console.log(`   Cookies: ${cookies.toString().substring(0, 80)}...`);

  // Follow redirect to Disclaimer
  const disclaimerUrl =
    step1.headers.get('location') ||
    `${CARE_BASE}/Search/Disclaimer.aspx?FromUrl=search/commonsearch.aspx?mode=persprop`;
  const fullDisclaimerUrl = disclaimerUrl.startsWith('http')
    ? disclaimerUrl
    : `https://a836-pts-access.nyc.gov${disclaimerUrl}`;

  console.log('\n2. GET disclaimer page...');
  const disclaimerPage = await fetchWithRetry(fullDisclaimerUrl, {
    headers: { Cookie: cookies.toString() },
  });
  cookies.update(disclaimerPage);
  const disclaimerHtml = await disclaimerPage.text();
  const disclaimerFields = parseAspNetFormFields(disclaimerHtml);
  console.log(`   Status: ${disclaimerPage.status}`);
  console.log(
    `   ViewState: ${disclaimerFields.viewState ? `found (${disclaimerFields.viewState.length} chars)` : 'MISSING'}`,
  );

  console.log('\n3. POST disclaimer (Agree)...');
  const agreeBody = new URLSearchParams({
    __VIEWSTATE: disclaimerFields.viewState,
    __EVENTVALIDATION: disclaimerFields.eventValidation,
    __VIEWSTATEGENERATOR: disclaimerFields.viewStateGenerator,
    btAgree: 'Agree',
  });

  const step2 = await fetchWithRetry(fullDisclaimerUrl, {
    method: 'POST',
    headers: {
      Cookie: cookies.toString(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: agreeBody.toString(),
    redirect: 'manual',
  });
  cookies.update(step2);
  console.log(`   Status: ${step2.status}`);
  console.log(`   Location: ${step2.headers.get('location') || '(none)'}`);

  console.log('\n4. GET search page (with session + disclaimer cookies)...');
  const step3 = await fetchWithRetry(
    `${CARE_BASE}/search/commonsearch.aspx?mode=persprop`,
    { headers: { Cookie: cookies.toString() } },
  );
  cookies.update(step3);
  const searchHtml = await step3.text();
  const searchFields = parseAspNetFormFields(searchHtml);
  console.log(`   Status: ${step3.status}`);
  console.log(
    `   ViewState: ${searchFields.viewState ? `found (${searchFields.viewState.length} chars)` : 'MISSING'}`,
  );
  console.log(
    `   EventValidation: ${searchFields.eventValidation ? 'found' : 'MISSING'}`,
  );

  if (!searchFields.viewState) {
    console.log('\n   DEBUG — first 1000 chars of search page:');
    console.log(searchHtml.substring(0, 1000));
    throw new Error('Failed to capture ViewState from search page');
  }

  console.log('\n   Session initialized successfully!');
  return { cookies, ...searchFields };
}

async function searchProperty(
  session: Awaited<ReturnType<typeof initSession>>,
  borough: string,
  block: string,
  lot: string,
): Promise<string | null> {
  console.log(
    `\n5. POST search (borough=${borough}, block=${block}, lot=${lot})...`,
  );

  const body = new URLSearchParams({
    __VIEWSTATE: session.viewState,
    __EVENTVALIDATION: session.eventValidation,
    __VIEWSTATEGENERATOR: session.viewStateGenerator,
    inpParid: borough,
    inpTag: block,
    inpStat: lot,
    btSearch: 'Search',
  });

  const response = await fetchWithRetry(
    `${CARE_BASE}/search/commonsearch.aspx?mode=persprop`,
    {
      method: 'POST',
      headers: {
        Cookie: session.cookies.toString(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      redirect: 'manual',
    },
  );
  session.cookies.update(response);

  const location = response.headers.get('location');
  console.log(`   Status: ${response.status}`);
  console.log(`   Location: ${location || '(none)'}`);

  if (
    (location && location.includes('Datalet')) ||
    (location && location.includes('datalet'))
  ) {
    const fullUrl = location.startsWith('http')
      ? location
      : `https://a836-pts-access.nyc.gov${location}`;
    console.log(`   -> Datalet URL: ${fullUrl}`);
    return fullUrl;
  }

  // Check for datalet link in HTML response
  if (response.status === 200) {
    const html = await response.text();
    const $ = cheerio.load(html);
    const dataletLink = $('a[href*="datalet.aspx"]').first().attr('href');
    if (dataletLink) {
      const fullUrl = dataletLink.startsWith('http')
        ? dataletLink
        : `https://a836-pts-access.nyc.gov${dataletLink.startsWith('/') ? '' : '/care/'}${dataletLink}`;
      console.log(`   -> Found datalet link in HTML: ${fullUrl}`);
      return fullUrl;
    }
    console.log('   -> No datalet link found in response');
    console.log(`   HTML preview: ${html.substring(0, 500)}`);
  }

  return null;
}

function parseLienCards(html: string): Array<{
  saleAmount: number;
  servicer: string;
  status: string;
  saleDate: string | null;
  redemptionDate: string | null;
  taxYear: string | null;
  redeemed: boolean;
}> {
  const $ = cheerio.load(html);
  const liens: ReturnType<typeof parseLienCards> = [];

  const allText = $.text();
  if (
    !allText.includes('Lien') &&
    !allText.includes('lien') &&
    !allText.includes('LIEN') &&
    !allText.includes('Tax Lien Sale')
  ) {
    return liens;
  }

  let saleAmount = 0;
  let servicer = '';
  let status = '';
  let saleDate: string | null = null;
  let redemptionDate: string | null = null;
  let taxYear: string | null = null;

  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    cells.each((i, cell) => {
      const text = $(cell).text().trim();
      const nextCell = cells.eq(i + 1);
      const nextText = nextCell.length ? nextCell.text().trim() : '';

      if (
        text.match(/sale\s*amount/i) ||
        text.match(/amount\s*sold/i) ||
        text.match(/lien\s*amount/i)
      ) {
        const amount = parseFloat(nextText.replace(/[$,\s]/g, ''));
        if (!isNaN(amount) && amount > 0) saleAmount = amount;
      }

      if (text.match(/servicer/i) || text.match(/purchaser/i)) {
        if (nextText) servicer = normalizeServicer(nextText);
      }

      if (text.match(/lien\s*status/i)) {
        if (nextText && nextText.length < 100) status = nextText;
      }

      if (text.match(/sale\s*date/i)) {
        if (nextText && nextText.match(/\d{2}\/\d{2}\/\d{4}/))
          saleDate = nextText;
      }

      if (
        text.match(/redm\s*date/i) ||
        text.match(/redemption\s*date/i) ||
        text.match(/redeemed\s*date/i)
      ) {
        if (nextText && nextText.match(/\d{2}\/\d{2}\/\d{4}/))
          redemptionDate = nextText;
      }

      if (text.match(/tax\s*year/i) || text.match(/fiscal\s*year/i)) {
        if (nextText && nextText.match(/^\d{4}$/)) taxYear = nextText;
      }
    });
  });

  if (saleAmount === 0) {
    const amountMatch = allText.match(
      /(?:sale\s*amount|amount\s*sold|lien\s*amount)[:\s]*\$?([\d,]+\.?\d*)/i,
    );
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) saleAmount = amount;
    }
  }

  if (saleAmount === 0) {
    $('[class*="DataletData"], [class*="datalet"]').each((_, el) => {
      const text = $(el).text().trim();
      const amountMatch = text.match(/\$?([\d,]+\.\d{2})/);
      if (amountMatch) {
        const prevText = $(el).prev().text().trim();
        if (prevText.match(/sale\s*amount/i) || prevText.match(/amount/i)) {
          saleAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
        }
      }
    });
  }

  const redeemed = status.toLowerCase().includes('redeem') || !!redemptionDate;

  if (saleAmount > 0 || status || servicer) {
    liens.push({
      saleAmount,
      servicer,
      status,
      saleDate,
      redemptionDate,
      taxYear,
      redeemed,
    });
  }

  return liens;
}

async function main() {
  const bbl = process.argv[2] || '3004050058';
  const borough = bbl[0];
  const block = String(parseInt(bbl.substring(1, 6)));
  const lot = String(parseInt(bbl.substring(6, 10)));

  console.log('='.repeat(60));
  console.log(`CARE Portal Scraper Test — BBL: ${bbl}`);
  console.log(`Borough: ${borough}, Block: ${block}, Lot: ${lot}`);
  console.log('='.repeat(60));

  // Step 1: Init session
  const session = await initSession();

  // Step 2: Search property
  const dataletUrl = await searchProperty(session, borough, block, lot);
  if (!dataletUrl) {
    console.log('\nNo CARE result found for this BBL.');
    process.exit(1);
  }

  // Step 3: Navigate to account history
  const sIndexMatch = dataletUrl.match(/sIndex=(\d+)/i);
  const sIndex = sIndexMatch ? sIndexMatch[1] : '0';
  const accHistUrl = `${CARE_BASE}/Datalets/datalet.aspx?mode=acc_hist_summ&sIndex=${sIndex}&idx=1&LMparent=20`;

  console.log(`\n6. GET account history (sIndex=${sIndex})...`);
  const accResponse = await fetchWithRetry(accHistUrl, {
    headers: { Cookie: session.cookies.toString() },
  });
  session.cookies.update(accResponse);
  const accHtml = await accResponse.text();
  console.log(`   Status: ${accResponse.status}`);
  console.log(`   HTML length: ${accHtml.length}`);

  // Dump raw HTML for debugging selectors
  console.log('\n--- RAW HTML (first 3000 chars) ---');
  console.log(accHtml.substring(0, 3000));
  console.log('--- END RAW HTML ---\n');

  // Step 4: Parse lien cards
  const liens = parseLienCards(accHtml);

  // Check for additional card links
  const $ = cheerio.load(accHtml);
  const cardLinks = $('a[href*="card="]')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter((href) => href && !href.includes('card=0'));

  if (cardLinks.length > 0) {
    console.log(`Found ${cardLinks.length} additional card link(s):`);
    for (const link of cardLinks) {
      console.log(`   ${link}`);
      const cardUrl = link.startsWith('http')
        ? link
        : `https://a836-pts-access.nyc.gov${link.startsWith('/') ? '' : '/care/'}${link}`;
      await new Promise((r) => setTimeout(r, 400));
      const cardResp = await fetchWithRetry(cardUrl, {
        headers: { Cookie: session.cookies.toString() },
      });
      session.cookies.update(cardResp);
      const cardHtml = await cardResp.text();
      const cardLiens = parseLienCards(cardHtml);
      liens.push(...cardLiens);
    }
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));

  if (liens.length === 0) {
    console.log('No lien data found.');
    console.log('\nThis likely means the HTML selectors need tuning.');
    console.log('Check the raw HTML dump above for the actual page structure.');
  } else {
    for (const [i, lien] of liens.entries()) {
      console.log(`\nLien ${i + 1}:`);
      console.log(`  Sale Amount:     $${lien.saleAmount.toLocaleString()}`);
      console.log(`  Servicer:        ${lien.servicer || '(not found)'}`);
      console.log(`  Status:          ${lien.status || '(not found)'}`);
      console.log(`  Sale Date:       ${lien.saleDate || '(not found)'}`);
      console.log(`  Redemption Date: ${lien.redemptionDate || '(not found)'}`);
      console.log(`  Tax Year:        ${lien.taxYear || '(not found)'}`);
      console.log(`  Redeemed:        ${lien.redeemed}`);
    }

    const total = liens.reduce((s, l) => s + l.saleAmount, 0);
    console.log(`\nTotal lien amount: $${total.toLocaleString()}`);
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
