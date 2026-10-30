import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_CREDENTIALS, validateWorkEmail, selectDemoCredentials } from './authUtils.ts';

describe('Authentication & Demo Role Regression Tests', () => {
  it('configured demo accounts have correct credentials and roles', () => {
    assert.equal(DEMO_CREDENTIALS.admin.email, 'admin@sentinelai.internal');
    assert.equal(DEMO_CREDENTIALS.admin.password, 'SentinelAdmin2026!');
    assert.equal(DEMO_CREDENTIALS.admin.role, 'ADMIN');

    assert.equal(DEMO_CREDENTIALS.analyst.email, 'analyst@sentinelai.internal');
    assert.equal(DEMO_CREDENTIALS.analyst.password, 'SentinelAnalyst2026!');
    assert.equal(DEMO_CREDENTIALS.analyst.role, 'ANALYST');
  });

  it('selecting Administrator demo account replaces empty fields', () => {
    const creds = selectDemoCredentials('admin');
    assert.equal(creds.email, 'admin@sentinelai.internal');
    assert.equal(creds.password, 'SentinelAdmin2026!');
  });

  it('selecting Security Analyst demo account replaces empty fields', () => {
    const creds = selectDemoCredentials('analyst');
    assert.equal(creds.email, 'analyst@sentinelai.internal');
    assert.equal(creds.password, 'SentinelAnalyst2026!');
  });

  it('switching between demo accounts REPLACES rather than concatenates the email and password', () => {
    // Start with Analyst
    let current = selectDemoCredentials('analyst');
    assert.equal(current.email, 'analyst@sentinelai.internal');

    // Switch to Admin: must replace completely, not append
    current = selectDemoCredentials('admin');
    assert.equal(current.email, 'admin@sentinelai.internal');
    assert.ok(!current.email.includes('analyst@sentinelai.internaladmin@sentinelai.internal'));
    assert.ok(!current.email.includes('in@sentinelai.internaladmin@sentinelai.internal'));

    // Switch back to Analyst
    current = selectDemoCredentials('analyst');
    assert.equal(current.email, 'analyst@sentinelai.internal');
    assert.ok(!current.email.includes('admin'));
  });

  it('rejects concatenated or corrupted email formats observed during issue reproduction', () => {
    const concatenated1 = 'in@sentinelai.internaladmin@sentinelai.internal';
    const res1 = validateWorkEmail(concatenated1);
    assert.equal(res1.isValid, false);
    assert.ok(res1.error?.includes('valid work email'));

    const concatenated2 = 'admin@sentinelai.internaladmin@sentinelai.internal';
    const res2 = validateWorkEmail(concatenated2);
    assert.equal(res2.isValid, false);
    assert.ok(res2.error?.includes('valid work email'));

    const noAt = 'adminsentinelai.internal';
    assert.equal(validateWorkEmail(noAt).isValid, false);
  });

  it('accepts and normalizes valid work emails with whitespace', () => {
    const validWithSpaces = '  admin@sentinelai.internal  ';
    const res = validateWorkEmail(validWithSpaces);
    assert.equal(res.isValid, true);
    assert.equal(res.normalized, 'admin@sentinelai.internal');
  });

  it('rejects empty or whitespace-only email submissions', () => {
    const emptyRes = validateWorkEmail('');
    assert.equal(emptyRes.isValid, false);
    assert.equal(emptyRes.error, 'Please enter your work email.');

    const spaceRes = validateWorkEmail('   ');
    assert.equal(spaceRes.isValid, false);
    assert.equal(spaceRes.error, 'Please enter your work email.');
  });
});
