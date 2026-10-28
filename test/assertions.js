// ABOUTME: Assertions the unit tests share that node:assert doesn't provide.
// ABOUTME: assertWithin checks a computed number is close enough to the spec's value.
import assert from 'node:assert/strict';

// Checks that actual is less than tolerance away from expected.
export function assertWithin(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`);
}
