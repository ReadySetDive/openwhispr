import test from "node:test";
import assert from "node:assert/strict";
import { RollingPreRollBuffer } from "../../src/helpers/rollingPreRollBuffer.js";

test("RollingPreRollBuffer: manages chunk queue and enforces maxDurationMs", () => {
  const buffer = new RollingPreRollBuffer({
    sampleRate: 16000,
    maxDurationMs: 500, // 500ms = 8000 samples
  });

  // Manually activate for testing queue logic
  buffer._active = true;

  // Push 4 chunks of 2000 samples (125ms each = 8000 samples total)
  buffer._onMessage(new Int16Array(2000));
  assert.equal(buffer.totalSamples, 2000);
  assert.equal(buffer.durationMs, 125);

  buffer._onMessage(new Int16Array(2000));
  buffer._onMessage(new Int16Array(2000));
  buffer._onMessage(new Int16Array(2000));
  assert.equal(buffer.totalSamples, 8000);
  assert.equal(buffer.durationMs, 500);

  // Push 5th chunk (2000 samples) -> oldest should be pruned
  buffer._onMessage(new Int16Array(2000));
  assert.equal(buffer.totalSamples, 8000); // 4 chunks of 2000 = 8000
  assert.equal(buffer._chunks.length, 4);

  // takePreRoll returns all buffered chunks and resets count
  const taken = buffer.takePreRoll();
  assert.equal(taken.length, 4);
  assert.equal(buffer.totalSamples, 0);
  assert.equal(buffer.paused, true);

  // Messages while paused should be ignored
  buffer._onMessage(new Int16Array(2000));
  assert.equal(buffer.totalSamples, 0);

  // Resume re-enables message collection
  buffer.resume();
  assert.equal(buffer.paused, false);
  buffer._onMessage(new Int16Array(1000));
  assert.equal(buffer.totalSamples, 1000);

  // setDurationMs dynamically prunes
  buffer.setDurationMs(250); // max 4000 samples
  buffer._onMessage(new Int16Array(4000));
  assert.ok(buffer.totalSamples <= 4000);
});
