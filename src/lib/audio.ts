// WebAudio synthesized SFX bus. Zero asset downloads, zero-latency triggers.
// Replaces term_audio_url / definition_audio_url files for the MVP —
// in production, real audio files override these synthesized tones.

type SfxName =
  | 'tap'
  | 'flip'
  | 'correct'
  | 'incorrect'
  | 'streak'
  | 'win'
  | 'lose'
  | 'pop'
  | 'whack'
  | 'launch'
  | 'hover'
  | 'countdown'
  | 'quarantine';

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private enabled = true;
  private queued: SfxName[] = [];

  init() {
    if (typeof window === 'undefined') return;
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
    // Flush any queued events that fired before user gesture
    if (this.queued.length) {
      const q = [...this.queued];
      this.queued = [];
      q.forEach((s) => this.play(s));
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.02);
    }
  }

  isMuted() {
    return this.muted;
  }

  play(name: SfxName, opts: { freq?: number; duration?: number } = {}) {
    if (!this.enabled) return;
    if (!this.ctx) {
      // Audio requires a user gesture — queue for init
      if (this.queued.length < 6) this.queued.push(name);
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.muted) return;

    const now = this.ctx.currentTime;
    const presets: Record<SfxName, { freq: number; type: OscillatorType; dur: number; sweep?: number; gain?: number }> = {
      tap:        { freq: 520, type: 'square', dur: 0.06, gain: 0.22 },
      flip:       { freq: 380, type: 'triangle', dur: 0.08, sweep: 620, gain: 0.22 },
      hover:      { freq: 680, type: 'sine', dur: 0.04, gain: 0.10 },
      correct:    { freq: 660, type: 'sine', dur: 0.18, sweep: 990, gain: 0.28 },
      incorrect:  { freq: 200, type: 'sawtooth', dur: 0.22, sweep: 110, gain: 0.28 },
      streak:     { freq: 880, type: 'triangle', dur: 0.24, sweep: 1320, gain: 0.30 },
      pop:        { freq: 740, type: 'triangle', dur: 0.10, sweep: 220, gain: 0.28 },
      whack:      { freq: 180, type: 'square', dur: 0.10, sweep: 80, gain: 0.30 },
      launch:     { freq: 220, type: 'sawtooth', dur: 0.5, sweep: 880, gain: 0.32 },
      win:        { freq: 523, type: 'sine', dur: 0.6, sweep: 1046, gain: 0.32 },
      lose:       { freq: 392, type: 'triangle', dur: 0.6, sweep: 196, gain: 0.30 },
      countdown:  { freq: 440, type: 'square', dur: 0.08, gain: 0.20 },
      quarantine: { freq: 110, type: 'sawtooth', dur: 0.8, sweep: 55, gain: 0.32 },
    };
    const p = presets[name];
    const freq = opts.freq ?? p.freq;
    const dur = opts.duration ?? p.dur;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(freq, now);
    if (p.sweep) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.sweep), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.gain ?? 0.25, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // Used by Phaser scenes to "play" a term — in production, this would
  // fetch the actual term_audio_url and decode it. Here we synthesize
  // a per-word tone signature based on the term's characters.
  playTerm(term: string) {
    if (!this.ctx || this.muted) {
      this.init();
      if (!this.ctx) return;
    }
    const chars = term.toLowerCase().replace(/[^a-z]/g, '').split('');
    if (chars.length === 0) {
      this.play('tap');
      return;
    }
    const base = 320;
    chars.slice(0, 8).forEach((c, i) => {
      const code = c.charCodeAt(0) - 97; // 0..25
      const freq = base + code * 12 + i * 20;
      setTimeout(() => this.play('tap', { freq, duration: 0.08 }), i * 70);
    });
  }
}

export const audioBus = new AudioBus();

// Initialize on first user gesture (PWA-safe)
if (typeof window !== 'undefined') {
  const handler = () => {
    audioBus.init();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}
