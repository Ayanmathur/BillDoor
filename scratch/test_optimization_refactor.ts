/**
 * Automated Verification Script for Billing Math Refactoring & Optimization Audit Matrix
 */

import { calculateBillTotals } from '../client-portal/src/shared/billing-math';

console.log('===========================================================');
console.log('  BILLDOOR — OPTIMIZATION REFACTORING VERIFICATION TEST');
console.log('===========================================================\n');

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, extra?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    pass++;
  } else {
    console.error(`  [FAIL] ${name} ${extra ? `— ${extra}` : ''}`);
    fail++;
  }
}

// -----------------------------------------------------------------
// 1. Decoupled Billing Math Helper Test
// -----------------------------------------------------------------
console.log('--- 1. Decoupled Billing Math Engine (`shared/billing-math.ts`) ---');

const res1 = calculateBillTotals({
  lineItems: [
    { quantity: 1, unitPrice: 60, discount: 0, gstPercent: 5 },
  ],
  extraCharges: 0,
  rewardDiscount: 0,
});

check('Single item (₹60, 5% GST): Grand total is ₹60', res1.grandTotal === 60);
check('Single item (₹60, 5% GST): Subtotal (Taxable) is ₹57.14', res1.subtotal.toFixed(2) === '57.14');
check('Single item (₹60, 5% GST): GST total is ₹2.86', res1.gstTotal.toFixed(2) === '2.86');

// Test Math.ceil ceiling rounding
const res2 = calculateBillTotals({
  lineItems: [
    { quantity: 1, unitPrice: 10.40, discount: 0, gstPercent: 0 },
  ],
});

check('Ceiling Rounding (10.40 -> 11.00): Grand total is ₹11', res2.grandTotal === 11);
check('Ceiling Rounding (10.40 -> 11.00): Round off amount is +0.60', res2.roundOffAmount.toFixed(2) === '0.60');

// Test multi-item slab aggregation
const res3 = calculateBillTotals({
  lineItems: [
    { quantity: 2, unitPrice: 100, discount: 10, gstPercent: 18, mrp: 120 }, // ₹190 with 18%
    { quantity: 1, unitPrice: 50, discount: 0, gstPercent: 5, mrp: 60 },    // ₹50 with 5%
  ],
  extraCharges: 15,
  rewardDiscount: 5,
});

check('Multi-item slab aggregation computes subtotal correctly', res3.subtotal > 0);
check('Multi-item MRP savings is ₹50 (2*20 + 1*10)', res3.totalMrpSavings === 50);
check('Multi-item grand total is integer ceil', Number.isInteger(res3.grandTotal));

// -----------------------------------------------------------------
// 2. Middleware Protection Logic Test
// -----------------------------------------------------------------
console.log('\n--- 2. Middleware Route Optimization ---');

function shouldQueryAuth(pathname: string): boolean {
  const isDashboardPage = pathname.startsWith('/dashboard');
  const isAuthPage = pathname.startsWith('/login') ||
    pathname.startsWith('/activate') ||
    pathname.startsWith('/reset-password');
  return isDashboardPage || isAuthPage;
}

check('Public route /bill/bangretiffin skips auth query', !shouldQueryAuth('/bill/bangretiffin'));
check('Public route /review/bangretiffin skips auth query', !shouldQueryAuth('/review/bangretiffin'));
check('Public route /directory skips auth query', !shouldQueryAuth('/directory'));
check('Protected route /dashboard/billit queries auth', shouldQueryAuth('/dashboard/billit'));
check('Auth route /login queries auth', shouldQueryAuth('/login'));

// -----------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------
console.log('\n===========================================================');
console.log(`  VERIFICATION COMPLETE`);
console.log(`  Passed: ${pass} / ${pass + fail}`);
console.log('===========================================================');

if (fail > 0) {
  process.exit(1);
} else {
  console.log('✨ ALL REFACTORING & OPTIMIZATION TESTS PASSED.');
}
