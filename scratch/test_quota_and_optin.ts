/**
 * Verification Script for WhatsApp Quota Management & Customer Opt-In Actions
 */

import { updateWhatsAppQuotaAction } from '../admin-portal/src/app/dashboard/actions';
import { toggleCustomerOptInAction } from '../client-portal/src/app/dashboard/billit/customers/actions';

console.log('===========================================================');
console.log('  BILLDOOR — QUOTA MANAGEMENT & OPT-IN VERIFICATION TEST');
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

async function runTests() {
  // 1. Check updateWhatsAppQuotaAction exported signature
  check('updateWhatsAppQuotaAction is defined', typeof updateWhatsAppQuotaAction === 'function');

  // 2. Check toggleCustomerOptInAction exported signature
  check('toggleCustomerOptInAction is defined', typeof toggleCustomerOptInAction === 'function');

  console.log('\n===========================================================');
  console.log(`  VERIFICATION COMPLETE`);
  console.log(`  Passed: ${pass} / ${pass + fail}`);
  console.log('===========================================================');
}

runTests();
