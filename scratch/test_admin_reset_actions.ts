/**
 * Automated Verification Script for Admin Reset & Delete Actions Validation
 */

import { resetClientUsernameAction, resetClientPasswordAction, deleteClientAction } from '../admin-portal/src/app/dashboard/actions';

console.log('===========================================================');
console.log('  BILLDOOR — ADMIN RESET & DELETE ACTIONS VALIDATION TEST');
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
  // 1. Username validation (<3 chars)
  const res1 = await resetClientUsernameAction({ clientId: 'fake-id', newUsername: 'ab' });
  check('Username <3 chars returns error', res1.error === 'Username must be at least 3 characters.');

  // 2. Password validation (<6 chars)
  const res2 = await resetClientPasswordAction({ clientId: 'fake-id', newPassword: '123' });
  check('Password <6 chars returns error', res2.error === 'Password must be at least 6 characters long.');

  // 3. Delete confirmation validation (mismatched string)
  const res3 = await deleteClientAction({ clientId: 'fake-id', confirmationText: 'del' });
  check('Incorrect delete confirmation string returns error', res3.error === 'You must type "DELETE" exactly to confirm client deletion.');

  console.log('\n===========================================================');
  console.log(`  VERIFICATION COMPLETE`);
  console.log(`  Passed: ${pass} / ${pass + fail}`);
  console.log('===========================================================');

  if (fail > 0) {
    process.exit(1);
  } else {
    console.log('✨ ALL ADMIN RESET & DELETE TESTS PASSED.');
  }
}

runTests();
