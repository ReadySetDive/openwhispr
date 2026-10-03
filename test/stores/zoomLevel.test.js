import test from "node:test";
import assert from "node:assert/strict";
import {
  snapZoomLevel,
  ZOOM_LEVEL_MIN,
  ZOOM_LEVEL_MAX,
  ZOOM_LEVEL_STEP,
} from "../../src/stores/settingsStore.ts";

test("snapZoomLevel: clamps and snaps to 5% increments", () => {
  assert.equal(ZOOM_LEVEL_MIN, 70);
  assert.equal(ZOOM_LEVEL_MAX, 150);
  assert.equal(ZOOM_LEVEL_STEP, 5);

  // Normal values
  assert.equal(snapZoomLevel(100), 100);
  assert.equal(snapZoomLevel(102), 100);
  assert.equal(snapZoomLevel(103), 105);
  assert.equal(snapZoomLevel(110), 110);

  // Clamping below min
  assert.equal(snapZoomLevel(50), 70);
  assert.equal(snapZoomLevel(68), 70);

  // Clamping above max
  assert.equal(snapZoomLevel(160), 150);
  assert.equal(snapZoomLevel(200), 150);

  // Fallbacks for invalid inputs
  assert.equal(snapZoomLevel(NaN), 100);
  assert.equal(snapZoomLevel(-10), 100);
  assert.equal(snapZoomLevel(null), 100);
  assert.equal(snapZoomLevel(undefined), 100);
});
