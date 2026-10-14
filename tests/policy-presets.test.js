import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateBeijingLimits } from '../src/policy-presets.js';
test('only untouched prior Beijing automatic limits migrate; custom limits and rates remain intact', () => {
  const previous = {city:'beijing',baseMode:'salary',socialMin:7162,socialMax:35811,fundMin:2540,fundMax:35811,fundRate:7,monthlyBase:20000};
  assert.deepEqual(migrateBeijingLimits(previous),{...previous,socialMin:0,socialMax:Number.MAX_SAFE_INTEGER,fundMin:0,fundMax:Number.MAX_SAFE_INTEGER});
  const latest={...previous,socialMin:7270,socialMax:36348,fundMax:36348};
  assert.equal(migrateBeijingLimits(latest).socialMax,Number.MAX_SAFE_INTEGER);
  for (const input of [{...previous,socialMax:30000},{...previous,baseMode:'custom'},{...previous,city:'shanghai'}]) assert.equal(migrateBeijingLimits(input),input);
});
