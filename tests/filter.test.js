import { SensorFilter } from '../src/filter.js';
import assert from 'node:assert';

console.log('--- TEST SENSOR FILTER ---');

// Mock localStorage for Node test environment
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

const filter = new SensorFilter(0.25);

// Test 1: First reading initialization
let res = filter.update(10, 20, 0);
assert.strictEqual(res.beta, 10, 'Initial beta should equal raw beta');
assert.strictEqual(res.gamma, 20, 'Initial gamma should equal raw gamma');
assert(res.totalTilt > 20, 'Total tilt should combine beta and gamma');
console.log('✓ Initial reading correct');

// Test 2: Low-pass filtering (EMA)
// If next raw reading is 20, filtered value gradually increases: 10 + 0.25 * (20 - 10) = 12.5
res = filter.update(20, 20, 0);
assert.strictEqual(res.beta, 12.5, 'Beta should be smoothed to 12.5');
console.log('✓ Low-Pass (EMA) filter calculates exponential moving average correctly');

// Test 3: Calibration / Tare
// Calibrate at current position: calibrated tilt must zero out
filter.calibrate();
assert(filter.isCalibrated(), 'Filter should be marked as calibrated');
res = filter.update(res.beta, res.gamma, 0);
assert(Math.abs(res.beta) < 0.001, 'Calibrated beta should be zero');
assert(Math.abs(res.gamma) < 0.001, 'Calibrated gamma should be zero');
assert(Math.abs(res.totalTilt) < 0.001, 'Calibrated total tilt should be zero');
console.log('✓ Tare / Zero calibration zeroes out angles properly');

// Test 4: Reset Calibration
filter.resetCalibration();
assert(!filter.isCalibrated(), 'Filter should not be calibrated after reset');
res = filter.update(20, 20, 0);
assert(res.beta > 10, 'Beta should return to uncalibrated measurement');
console.log('✓ Reset calibration restores original values');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
