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

  // ===========================================================================
  // AAA 2029 — TEXT-TO-SPEECH (Web Speech API)
  // Premium TTS with natural voice selection, prosody tuning, and activity cancel.
  // ===========================================================================
  private ttsEnabled = true;
  private ttsVoice: SpeechSynthesisVoice | null = null;
  private ttsVoiceReady = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  /** Enable/disable TTS at runtime (toggled by the 🔊 Audio button) */
  setTTSEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
    if (!enabled) {
      this.stopSpeaking();
    }
  }

  isTTSEnabled() {
    return this.ttsEnabled;
  }

  /** Initialize TTS voice — prefer the most natural-sounding voice available */
  initTTS() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.ttsVoiceReady) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return false;
      // Priority 1: Premium/natural voices (Google, Microsoft Natural, Apple Enhanced)
      this.ttsVoice =
        voices.find(v => v.lang === 'en-US' && /google us english|natural|enhanced|premium/i.test(v.name)) ??
        voices.find(v => v.lang === 'en-US' && /samantha|victoria|karen|moira|fiona|serena/i.test(v.name)) ??
        voices.find(v => v.lang === 'en-US' && /female|woman/i.test(v.name)) ??
        voices.find(v => v.lang === 'en-US' && /microsoft|google/i.test(v.name)) ??
        voices.find(v => v.lang === 'en-US') ??
        voices.find(v => v.lang === 'en-GB' && /female|kate|serena/i.test(v.name)) ??
        voices.find(v => v.lang.startsWith('en')) ??
        voices[0];
      this.ttsVoiceReady = true;
      return true;
    };
    if (pickVoice()) {
      // Voices loaded successfully
      window.speechSynthesis.onvoiceschanged = null;
    } else {
      // Voices not loaded yet — set up listener + retry
      window.speechSynthesis.onvoiceschanged = pickVoice;
      // Retry every 250ms for up to 5 seconds (some browsers are slow)
      let attempts = 0;
      const retry = setInterval(() => {
        if (pickVoice() || attempts++ > 20) {
          clearInterval(retry);
        }
      }, 250);
    }
  }

  /** Speak any text aloud with natural prosody. Cancels any in-progress speech. */
  speak(text: string, opts: { rate?: number; pitch?: number; volume?: number; isQuestion?: boolean } = {}) {
    if (!this.ttsEnabled || this.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.initTTS();
    try {
      // Clean text for speech (remove emojis, special chars)
      const cleanText = text
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // Remove emojis
        .replace(/[🎈🎯🧭✈️🚀🃏🔗🔨🔤🔍⌨️📇🎡🗃️🌟⭐🔥💡🎯❤💔]/g, '') // Remove game emojis
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanText) return;

      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = this.ttsVoice?.lang ?? 'en-US';
      // Natural prosody: slightly varied rate, higher pitch for questions
      const isQ = opts.isQuestion ?? cleanText.includes('?');
      utter.rate = opts.rate ?? (isQ ? 0.88 : 0.92);
      utter.pitch = opts.pitch ?? (isQ ? 1.15 : 1.05);
      utter.volume = opts.volume ?? 1.0;

      // Pick a voice if available
      if (!this.ttsVoice) this.initTTS();
      if (this.ttsVoice) utter.voice = this.ttsVoice;

      this.currentUtterance = utter;
      utter.onend = () => { this.currentUtterance = null; };
      utter.onerror = () => { this.currentUtterance = null; };

      // Detect iOS Safari — requires synchronous speak() from user gesture
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const doSpeak = () => {
        try {
          window.speechSynthesis.speak(utter);
        } catch {}
      };

      if (isIOS) {
        // iOS: cancel + speak synchronously (no setTimeout — breaks gesture chain)
        window.speechSynthesis.cancel();
        doSpeak();
      } else {
        // Desktop/Android: cancel, then speak after tiny delay
        // Without the delay, Chrome cancels the new utterance before it starts
        window.speechSynthesis.cancel();
        setTimeout(doSpeak, 50);
      }
    } catch {
      // TTS not available — fail silently
    }
  }

  /** Speak a term + its definition (used when a term card is shown) */
  speakTerm(term: string, definition?: string) {
    if (definition) {
      this.speak(`${term}. ${definition}`);
    } else {
      this.speak(term);
    }
  }

  /** Stop any in-progress speech */
  stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // ===========================================================================
  // AAAA — AMBIENT SOUNDSCAPE (replaces old procedural music)
  // ============================================================================
  // Instead of a repetitive melody loop, we play a soft ambient pad —
  // a low drone with occasional gentle bell tones. This creates a
  // calming background that doesn't distract from gameplay.
  // The pad pitch shifts per world for variety.
  // ============================================================================

  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientInterval: ReturnType<typeof setInterval> | null = null;
  private ambientEnabled = false;
  private currentWorldId: string = 'space';

  startMusic() {
    if (!this.ctx || this.ambientEnabled) return;
    this.ambientEnabled = true;

    // Ambient pad — two detuned oscillators for a warm, evolving drone
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.04; // very quiet
    this.ambientGain.connect(this.master!);

    // Base frequency depends on world (different musical key per world)
    const baseFreq = this.getWorldBaseFreq(this.currentWorldId);

    this.ambientOsc1 = this.ctx.createOscillator();
    this.ambientOsc1.type = 'sine';
    this.ambientOsc1.frequency.value = baseFreq;

    this.ambientOsc2 = this.ctx.createOscillator();
    this.ambientOsc2.type = 'sine';
    this.ambientOsc2.frequency.value = baseFreq * 1.5; // perfect fifth
    this.ambientOsc2.detune.value = 5; // slight detune for warmth

    // Low-pass filter for softness
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    this.ambientOsc1.connect(filter);
    this.ambientOsc2.connect(filter);
    filter.connect(this.ambientGain);

    this.ambientOsc1.start();
    this.ambientOsc2.start();

    // Gentle LFO on the gain for a "breathing" effect
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.1; // very slow, 10s cycle
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientGain.gain);
    lfo.start();

    // Occasional gentle bell tones (every 8-15 seconds)
    this.ambientInterval = setInterval(() => {
      if (!this.ctx || !this.ambientEnabled) return;
      this.playBellTone(baseFreq);
    }, 8000 + Math.random() * 7000);
  }

  setWorld(worldId: string) {
    this.currentWorldId = worldId;
    // If ambient is playing, smoothly transition to new key
    if (this.ambientEnabled && this.ambientOsc1 && this.ambientOsc2) {
      const baseFreq = this.getWorldBaseFreq(worldId);
      const now = this.ctx!.currentTime;
      this.ambientOsc1.frequency.setTargetAtTime(baseFreq, now, 1);
      this.ambientOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 1);
    }
  }

  private getWorldBaseFreq(worldId: string): number {
    // Each world has a different base note (pentatonic-friendly)
    const worldFreqs: Record<string, number> = {
      space: 130.81,      // C3 — cosmic, deep
      jungle: 146.83,     // D3 — earthy
      festival: 164.81,   // E3 — bright
      cityscape: 110.00,  // A2 — urban
      ocean: 98.00,       // G2 — watery
      candy: 174.61,      // F3 — sweet
      haunted: 87.31,     // F2 — spooky
      sports: 196.00,     // G3 — energetic
      christmas: 130.81,  // C3 — classic
      easter: 155.56,     // Eb3 — spring
    };
    return worldFreqs[worldId] ?? 130.81;
  }

  private playBellTone(baseFreq: number) {
    if (!this.ctx || !this.ambientGain) return;
    // Pentatonic scale intervals from base
    const intervals = [1, 9/8, 5/4, 3/2, 5/3]; // major pentatonic
    const interval = intervals[Math.floor(Math.random() * intervals.length)];
    const freq = baseFreq * 4 * interval; // two octaves up

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 2);
  }

  stopMusic() {
    this.ambientEnabled = false;
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.ambientOsc1) {
      try { this.ambientOsc1.stop(); } catch {}
      this.ambientOsc1 = null;
    }
    if (this.ambientOsc2) {
      try { this.ambientOsc2.stop(); } catch {}
      this.ambientOsc2 = null;
    }
    if (this.ambientGain) {
      try { this.ambientGain.disconnect(); } catch {}
      this.ambientGain = null;
    }
  }
}

export const audioBus = new AudioBus();

// Initialize on first user gesture (PWA-safe)
if (typeof window !== 'undefined') {
  const handler = () => {
    audioBus.init();
    audioBus.initTTS(); // Initialize TTS voices on first gesture
    // AAAA — iOS Safari unlock: speak a near-silent utterance synchronously
    // from the user gesture. This unlocks the speech engine for ALL future
    // programmatic calls. Without this, iOS blocks TTS that isn't triggered
    // directly from a user tap.
    try {
      if ('speechSynthesis' in window) {
        const unlock = new SpeechSynthesisUtterance(' ');
        unlock.volume = 0;
        unlock.rate = 1;
        window.speechSynthesis.speak(unlock);
      }
    } catch {}
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}
