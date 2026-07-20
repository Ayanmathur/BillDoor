const http = require('http');

// Simple rate limit test script for BillDoor public endpoints
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const NUM_REQUESTS = 40;
const CONCURRENT = true;

async function fetchEndpoint(url) {
  try {
    const res = await fetch(url, {
      headers: {
        // Mocking a standard browser request
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RateLimitTester/1.0',
        // Next.js server actions are sometimes POSTs, but we will test the page GET requests first
      }
    });
    return res.status;
  } catch (err) {
    return 'ERROR';
  }
}

async function testRateLimit(endpointName, url) {
  console.log(`\nTesting ${endpointName} (${url})...`);
  console.log(`Sending ${NUM_REQUESTS} requests...`);
  
  const promises = [];
  for (let i = 0; i < NUM_REQUESTS; i++) {
    if (CONCURRENT) {
      promises.push(fetchEndpoint(url));
    } else {
      const status = await fetchEndpoint(url);
      promises.push(status);
    }
  }

  const results = CONCURRENT ? await Promise.all(promises) : promises;
  
  const successCount = results.filter(s => s === 200).length;
  const tooManyRequestsCount = results.filter(s => s === 429).length;
  const otherCount = results.length - successCount - tooManyRequestsCount;

  console.log(`Results for ${endpointName}:`);
  console.log(`- 200 OK: ${successCount}`);
  console.log(`- 429 Too Many Requests: ${tooManyRequestsCount}`);
  if (otherCount > 0) {
    console.log(`- Other statuses: ${otherCount} (e.g. 500, ERROR)`);
  }

  if (tooManyRequestsCount > 0) {
    console.log(`[PASS] Rate limiting is active on ${endpointName}.`);
  } else {
    console.log(`[FAIL] Rate limiting was NOT triggered. (Expected some 429s)`);
  }
}

async function runAll() {
  console.log("=== Phase 8: Rate Limit Testing ===\n");
  
  // Note: These endpoints need to be actually running on localhost:3000
  // Test 1: Digital Bill
  await testRateLimit('Digital Bill Page', `${APP_URL}/bill/test-bill-slug`);
  
  // Test 2: Public Booking
  await testRateLimit('Public Booking Page', `${APP_URL}/book/test-business-slug`);
  
  // Test 3: Digital Catalog
  await testRateLimit('Digital Catalog Page', `${APP_URL}/catalog/test-business-slug`);
  
  console.log("\nRate Limit Testing Complete.");
}

runAll().catch(console.error);
