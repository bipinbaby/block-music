import * as Tone from 'tone';

/**
 * Manages the Tone.js audio graph.
 * All Tone.js node creation/destruction happens here — never in React.
 */
class AudioEngine {
  constructor() {
    // Map<blockId, { synth, gain, reverb, delay, lfo, nodes }>
    this.voices = new Map();
    this.initialized = false;
    this.masterGain = null;
    this._scheduleId = null;
    this._onStep = null; // callback(step, time) from useAudioSync
  }

  async initialize() {
    if (this.initialized) return;
    await Tone.start();
    this.masterGain = new Tone.Volume(-6).toDestination();
    this.initialized = true;
  }

  setMasterVolume(db) {
    if (this.masterGain) this.masterGain.volume.value = db;
  }

  async createVoice(block) {
    if (this.voices.has(block.id)) return;

    const synth = new Tone.MonoSynth({
      oscillator: { type: block.oscillator.type },
      filter: { type: block.filter.type, frequency: block.filter.frequency, Q: block.filter.Q },
      envelope: block.amplifier.envelope,
      filterEnvelope: {
        ...block.filter.envelope,
        baseFrequency: block.filter.frequency,
      },
    });

    const gain = new Tone.Gain(block.amplifier.gain);

    // Build FX chain
    const reverb = new Tone.Reverb({ decay: block.fx.reverb.roomSize * 5 + 0.5, wet: 0 });
    const delay = new Tone.FeedbackDelay({
      delayTime: block.fx.delay.time,
      feedback: block.fx.delay.feedback,
      wet: 0,
    });

    await reverb.ready;

    // Chain: synth → gain → reverb → delay → masterGain
    synth.connect(gain);
    gain.connect(reverb);
    reverb.connect(delay);
    delay.connect(this.masterGain ?? Tone.getDestination());

    // Apply FX wet levels
    if (block.fx.reverb.enabled) reverb.wet.value = block.fx.reverb.wet;
    if (block.fx.delay.enabled) delay.wet.value = block.fx.delay.wet;

    // LFO
    let lfo = null;
    if (block.lfo.enabled) {
      lfo = this._createLFO(block, synth, gain);
      lfo.start();
    }

    this.voices.set(block.id, { synth, gain, reverb, delay, lfo });
  }

  _createLFO(block, synth, gain) {
    const lfo = new Tone.LFO({
      type: block.lfo.type,
      frequency: block.lfo.tempoSynced
        ? Tone.Time(block.lfo.rate).toFrequency()
        : block.lfo.rate,
      min: 0,
      max: 1,
      amplitude: block.lfo.depth,
    });

    if (block.lfo.target === 'filter.frequency') {
      const range = 4000 * block.lfo.depth;
      lfo.min = Math.max(20, block.filter.frequency - range);
      lfo.max = Math.min(20000, block.filter.frequency + range);
      lfo.connect(synth.filter.frequency);
    } else if (block.lfo.target === 'amplifier.gain') {
      lfo.min = 0;
      lfo.max = block.amplifier.gain;
      lfo.connect(gain.gain);
    } else if (block.lfo.target === 'oscillator.detune') {
      lfo.min = -100 * block.lfo.depth;
      lfo.max = 100 * block.lfo.depth;
      lfo.connect(synth.detune);
    }
    return lfo;
  }

  updateVoice(block) {
    const voice = this.voices.get(block.id);
    if (!voice) return;
    const { synth, gain, reverb, delay, lfo } = voice;

    // Oscillator
    if (synth.oscillator.type !== block.oscillator.type) {
      synth.oscillator.type = block.oscillator.type;
    }

    // Filter
    synth.filter.type = block.filter.type;
    synth.filter.frequency.value = block.filter.frequency;
    synth.filter.Q.value = block.filter.Q;
    synth.filterEnvelope.attack = block.filter.envelope.attack;
    synth.filterEnvelope.decay = block.filter.envelope.decay;
    synth.filterEnvelope.sustain = block.filter.envelope.sustain;
    synth.filterEnvelope.release = block.filter.envelope.release;
    synth.filterEnvelope.baseFrequency = block.filter.frequency;
    synth.filterEnvelope.octaves = block.filter.envelope.amount / 1200;

    // Amp envelope
    synth.envelope.attack = block.amplifier.envelope.attack;
    synth.envelope.decay = block.amplifier.envelope.decay;
    synth.envelope.sustain = block.amplifier.envelope.sustain;
    synth.envelope.release = block.amplifier.envelope.release;
    gain.gain.value = block.amplifier.gain;

    // FX
    reverb.wet.value = block.fx.reverb.enabled ? block.fx.reverb.wet : 0;
    delay.wet.value = block.fx.delay.enabled ? block.fx.delay.wet : 0;
    delay.feedback.value = block.fx.delay.feedback;

    // LFO
    if (lfo) {
      lfo.stop();
      lfo.dispose();
      voice.lfo = null;
    }
    if (block.lfo.enabled) {
      voice.lfo = this._createLFO(block, synth, gain);
      voice.lfo.start();
    }
  }

  destroyVoice(blockId) {
    const voice = this.voices.get(blockId);
    if (!voice) return;
    const { synth, gain, reverb, delay, lfo } = voice;
    try {
      if (lfo) { lfo.stop(); lfo.dispose(); }
      synth.dispose();
      gain.dispose();
      reverb.dispose();
      delay.dispose();
    } catch {}
    this.voices.delete(blockId);
  }

  triggerBlock(blockId, note, duration, time) {
    const voice = this.voices.get(blockId);
    if (!voice) return;
    const durationTime = Tone.Time('16n').toSeconds() * duration;
    voice.synth.triggerAttackRelease(note, durationTime, time);
  }

  previewBlock(blockId, note) {
    const voice = this.voices.get(blockId);
    if (!voice) return;
    voice.synth.triggerAttackRelease(note, '8n');
  }

  pruneVoices(activeIds) {
    const idSet = new Set(activeIds);
    for (const id of this.voices.keys()) {
      if (!idSet.has(id)) this.destroyVoice(id);
    }
  }

  hasVoice(blockId) {
    return this.voices.has(blockId);
  }

  startTransport(bpm, totalColumns, onStep) {
    this._onStep = onStep;
    Tone.getTransport().bpm.value = bpm;

    this._scheduleId = Tone.getTransport().scheduleRepeat((time) => {
      const sixteenth = Tone.getTransport().ticks / (Tone.getTransport().PPQ / 4);
      const step = Math.floor(sixteenth) % totalColumns;
      if (this._onStep) this._onStep(step, time);
    }, '16n');

    Tone.getTransport().start();
  }

  stopTransport() {
    Tone.getTransport().stop();
    if (this._scheduleId !== null) {
      Tone.getTransport().clear(this._scheduleId);
      this._scheduleId = null;
    }
    Tone.getTransport().position = 0;
  }

  pauseTransport() {
    Tone.getTransport().pause();
  }

  setBpm(bpm) {
    Tone.getTransport().bpm.value = bpm;
  }

  /**
   * Render the composition to an AudioBuffer for WAV export.
   * Rebuilds the entire graph in an OfflineAudioContext.
   */
  async renderToBuffer(blocks, bpm, totalColumns) {
    const stepsPerBeat = 4; // 16th note = 1/4 beat
    const totalBeats = totalColumns / stepsPerBeat;
    const durationSeconds = (totalBeats / bpm) * 60 + 3; // +3s tail

    const buffer = await Tone.Offline(async ({ transport }) => {
      transport.bpm.value = bpm;

      const dest = Tone.getDestination();

      // Build all voices offline
      const offlineVoices = new Map();
      for (const block of blocks) {
        const synth = new Tone.MonoSynth({
          oscillator: { type: block.oscillator.type },
          filter: { type: block.filter.type, frequency: block.filter.frequency, Q: block.filter.Q },
          envelope: block.amplifier.envelope,
          filterEnvelope: {
            ...block.filter.envelope,
            baseFrequency: block.filter.frequency,
          },
        });
        const gain = new Tone.Gain(block.amplifier.gain);
        const reverb = new Tone.Reverb({ decay: block.fx.reverb.roomSize * 5 + 0.5, wet: block.fx.reverb.enabled ? block.fx.reverb.wet : 0 });
        const delay = new Tone.FeedbackDelay({
          delayTime: block.fx.delay.time,
          feedback: block.fx.delay.feedback,
          wet: block.fx.delay.enabled ? block.fx.delay.wet : 0,
        });
        await reverb.ready;
        synth.connect(gain);
        gain.connect(reverb);
        reverb.connect(delay);
        delay.connect(dest);
        offlineVoices.set(block.id, { synth, gain, reverb, delay });
      }

      // Schedule each block
      for (const block of blocks) {
        const voice = offlineVoices.get(block.id);
        if (!voice) continue;
        // Each column is one 16th note
        const timeStr = `${block.column}*0:0:1`;
        const durationStr = `${block.duration}*0:0:1`;
        transport.schedule((time) => {
          const dur = Tone.Time(durationStr).toSeconds();
          voice.synth.triggerAttackRelease(block.note, dur, time);
        }, timeStr);
      }

      transport.start(0);
    }, durationSeconds);

    return buffer;
  }
}

// Singleton
export const audioEngine = new AudioEngine();
