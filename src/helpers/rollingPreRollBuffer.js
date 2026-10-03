/**
 * RollingPreRollBuffer
 *
 * Maintains a circular buffer of 16 kHz mono Int16 PCM audio chunks from an
 * active microphone stream. When dictation starts, takePreRoll() snapshots
 * the buffered audio (e.g. last 250ms, 500ms, or 1000ms) to prepend to the
 * recording, eliminating hardware start latency and preventing clipped speech.
 */
export class RollingPreRollBuffer {
  constructor({
    sampleRate = 16000,
    maxDurationMs = 500,
    getWorkletBlobUrl,
    onActiveChange = null,
  } = {}) {
    this.sampleRate = sampleRate;
    this.maxDurationMs = maxDurationMs;
    this.getWorkletBlobUrl = getWorkletBlobUrl;
    this.onActiveChange = onActiveChange;

    this._chunks = [];
    this._totalSamples = 0;
    this._stream = null;
    this._context = null;
    this._source = null;
    this._node = null;
    this._active = false;
    this._paused = false;
  }

  get active() {
    return this._active;
  }

  get paused() {
    return this._paused;
  }

  get totalSamples() {
    return this._totalSamples;
  }

  get durationMs() {
    return Math.round((this._totalSamples / this.sampleRate) * 1000);
  }

  setDurationMs(durationMs) {
    this.maxDurationMs = durationMs > 0 ? durationMs : 0;
    this._prune();
  }

  /**
   * Starts rolling capture on the provided MediaStream.
   */
  async start(stream) {
    if (this._active) {
      this.resume();
      return;
    }
    if (!stream || !this.getWorkletBlobUrl) return;

    this._stream = stream;
    this._chunks = [];
    this._totalSamples = 0;
    this._paused = false;

    try {
      this._context = new AudioContext({ sampleRate: this.sampleRate });
      if (this._context.state === "suspended") {
        this._context.resume().catch(() => {});
      }

      const blobUrl = this.getWorkletBlobUrl();
      await this._context.audioWorklet.addModule(blobUrl);

      this._node = new AudioWorkletNode(this._context, "pcm-streaming-processor", {
        channelCount: 1,
        channelCountMode: "explicit",
      });
      this._node.port.onmessage = (event) => this._onMessage(event.data);

      this._source = this._context.createMediaStreamSource(stream);
      this._source.connect(this._node);

      this._active = true;
      this.onActiveChange?.(true);
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  _onMessage(data) {
    if (this._paused || !this._active) return;
    if (typeof data === "string") return;

    const chunk = data instanceof Int16Array ? data : new Int16Array(data);
    if (chunk.length === 0) return;

    this._chunks.push(chunk);
    this._totalSamples += chunk.length;
    this._prune();
  }

  _prune() {
    const maxSamples = Math.round((this.maxDurationMs / 1000) * this.sampleRate);
    while (this._totalSamples > maxSamples && this._chunks.length > 1) {
      const removed = this._chunks.shift();
      if (removed) this._totalSamples -= removed.length;
    }
  }

  /**
   * Consumes and returns a snapshot of buffered audio chunks, then pauses
   * buffering until resume() is called.
   */
  takePreRoll() {
    if (!this._active || this._chunks.length === 0) {
      this._paused = true;
      return [];
    }
    const snapshot = [...this._chunks];
    this._chunks = [];
    this._totalSamples = 0;
    this._paused = true;
    return snapshot;
  }

  /**
   * Resumes continuous buffering after a dictation completes.
   */
  resume() {
    this._chunks = [];
    this._totalSamples = 0;
    this._paused = false;
  }

  /**
   * Stops the rolling buffer and disposes Web Audio nodes.
   */
  stop() {
    const wasActive = this._active;
    this._active = false;
    this._paused = true;
    this._chunks = [];
    this._totalSamples = 0;

    try {
      this._source?.disconnect();
      this._node?.disconnect();
      this._context?.close().catch(() => {});
    } catch {
      // Ignore teardown errors
    }

    this._source = null;
    this._node = null;
    this._context = null;
    this._stream = null;

    if (wasActive) {
      this.onActiveChange?.(false);
    }
  }
}
