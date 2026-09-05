export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Engine synth
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isEnginePlaying = false;

  // Tire squeal synth (filtered noise)
  private squealSource: AudioBufferSourceNode | null = null;
  private squealGain: GainNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;

  // Music sequencer
  private isMusicPlaying = false;
  private musicInterval: any = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public unlock() {
    this.initContext();
  }

  public setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
  }

  public setSFXVolume(val: number) {
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
  }

  public setMusicVolume(val: number) {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
  }

  // --- Engine Sound Synth ---
  public startEngine() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isEnginePlaying) return;

    try {
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';

      this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      this.engineOsc1.connect(this.engineGain);
      this.engineOsc2.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.isEnginePlaying = true;
    } catch (e) {
      // Audio autoplay policy
    }
  }

  public updateEnginePitch(speedRatio: number, isDrifting: boolean, isBoost: boolean) {
    if (!this.ctx || !this.isEnginePlaying || !this.engineOsc1 || !this.engineOsc2 || !this.engineGain) return;

    const baseFreq = 48 + speedRatio * 160 + (isBoost ? 60 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, this.ctx.currentTime, 0.05);

    const gain = 0.08 + speedRatio * 0.14 + (isBoost ? 0.08 : 0);
    this.engineGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
  }

  public stopEngine() {
    if (this.engineOsc1) {
      try { this.engineOsc1.stop(); this.engineOsc1.disconnect(); } catch (e) {}
      this.engineOsc1 = null;
    }
    if (this.engineOsc2) {
      try { this.engineOsc2.stop(); this.engineOsc2.disconnect(); } catch (e) {}
      this.engineOsc2 = null;
    }
    this.isEnginePlaying = false;
  }

  // --- Drift Tire Squeal ---
  public playTireSqueal(active: boolean) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    if (active) {
      if (!this.squealSource) {
        // Generate white noise buffer
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        this.squealSource = this.ctx.createBufferSource();
        this.squealSource.buffer = buffer;
        this.squealSource.loop = true;

        this.squealFilter = this.ctx.createBiquadFilter();
        this.squealFilter.type = 'bandpass';
        this.squealFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        this.squealFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        this.squealGain = this.ctx.createGain();
        this.squealGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

        this.squealSource.connect(this.squealFilter);
        this.squealFilter.connect(this.squealGain);
        this.squealGain.connect(this.sfxGain);

        this.squealSource.start();
      }
    } else {
      if (this.squealSource) {
        try { this.squealSource.stop(); this.squealSource.disconnect(); } catch (e) {}
        this.squealSource = null;
      }
    }
  }

  // --- Boost Sound ---
  public playBoost() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  // --- Crash / Impact Sound ---
  public playImpact(intensity = 1.0) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.2);

    const volume = Math.min(0.35, 0.15 * intensity);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  // --- Countdown Beeps ---
  public playCountdownBeep(isGo = false) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    const freq = isGo ? 880 : 440; // High tone for GO
    const duration = isGo ? 0.6 : 0.25;

    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // --- Horn Sound ---
  public playHorn(hornId = 1) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const frequencies: Record<number, [number, number]> = {
      1: [440, 554], // Classic dual tone
      2: [620, 620], // Beep beep
      3: [784, 988], // High pitch
      4: [220, 277], // Low truck
      5: [523, 659], // Melodic
      6: [330, 493], // Electro
    };

    const tones = frequencies[hornId] || frequencies[1];
    tones.forEach((freq) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    });
  }

  // --- Nitro Pickup Sound ---
  public playNitroPickup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [587.33, 880.00, 1174.66, 1760.00]; // D5, A5, D6, A6 powerup sweep
    notes.forEach((freq, index) => {
      if (!this.ctx || !this.sfxGain) return;
      const startTime = this.ctx.currentTime + index * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.24, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  // --- Lap Complete Fanfare ---
  public playLapComplete() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      if (!this.ctx || !this.sfxGain) return;
      const startTime = this.ctx.currentTime + index * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  // --- Retro Chiptune Background Melody ---
  public startRetroMusic(track: 'menu' | 'race' | 'victory' = 'race') {
    this.initContext();
    if (!this.ctx || !this.musicGain || this.isMusicPlaying) return;

    this.isMusicPlaying = true;
    const bpm = track === 'race' ? 136 : 108;
    const beatSec = 60 / bpm;

    // Chiptune scale notes (Hz)
    const raceMelody = [
      261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66,
      329.63, 349.23, 392.00, 523.25, 493.88, 440.00, 392.00, 349.23,
      392.00, 440.00, 493.88, 587.33, 523.25, 440.00, 392.00, 329.63,
      261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00
    ];

    let noteIndex = 0;
    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.isMusicPlaying) return;

      const freq = raceMelody[noteIndex % raceMelody.length];
      noteIndex++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const noteDuration = beatSec * 0.45;
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start();
      osc.stop(this.ctx.currentTime + noteDuration);
    }, beatSec * 500); // 8th notes
  }

  public stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isMusicPlaying = false;
  }
}

// Global singleton for consistent audio lifecycle across pages
let soundEngineInstance: SoundEngine | null = null;
export function getSoundEngine(): SoundEngine {
  if (!soundEngineInstance) {
    soundEngineInstance = new SoundEngine();
  }
  return soundEngineInstance;
}
