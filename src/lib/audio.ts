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
    if (!this.ctx || !this.master) {
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
    try { gain.connect(this.master); } catch { return; }
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

  /** Initialize TTS voice — prefer the most natural-sounding voice available */
  initTTS() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.ttsVoiceReady) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
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
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  /** Speak any text aloud with natural prosody. Cancels any in-progress speech. */
  speak(text: string, opts: { rate?: number; pitch?: number; volume?: number; isQuestion?: boolean } = {}) {
    if (!this.ttsEnabled || this.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.initTTS();
    try {
      // Cancel any in-progress speech immediately
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
      // Resume if suspended (mobile browsers often start suspended)
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

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
      utter.rate = opts.rate ?? (isQ ? 0.88 : 0.92); // Questions slightly slower
      utter.pitch = opts.pitch ?? (isQ ? 1.15 : 1.05); // Questions slightly higher
      utter.volume = opts.volume ?? 1.0;

      // Pick a voice if available
      if (!this.ttsVoice) this.initTTS();
      if (this.ttsVoice) utter.voice = this.ttsVoice;

      // Track current utterance for cancel
      this.currentUtterance = utter;
      utter.onend = () => { this.currentUtterance = null; };
      utter.onerror = () => { this.currentUtterance = null; };

      // Speak with small delay to ensure cancel completes
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utter);
        } catch {}
      }, 50);
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

  /** Enable / disable text-to-speech globally (toggled from UI) */
  setTTSEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
    if (!enabled) this.stopSpeaking();
  }

  /** Whether TTS is currently enabled */
  isTTSEnabled() {
    return this.ttsEnabled;
  }

  // ===========================================================================
  // AAA 2029 — BACKGROUND MUSIC (procedural, no audio files)
  // Simple ambient melody loop using WebAudio oscillators.
  // Kahoout-style lobby music identity.
  // ===========================================================================
  private musicGain: GainNode | null = null;
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private musicEnabled = false;

  startMusic() {
    if (!this.ctx || this.musicEnabled) return;
    this.musicEnabled = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.08; // quiet background
    this.musicGain.connect(this.master!);

    // Simple pentatonic melody loop (C, D, E, G, A)
    const notes = [523, 587, 659, 784, 880, 784, 659, 587];
    let noteIdx = 0;

    const playNote = () => {
      if (!this.ctx || !this.musicEnabled || !this.musicGain) return;
      const now = this.ctx.currentTime;
      const freq = notes[noteIdx % notes.length];
      noteIdx++;

      // Main note
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.4);

      // Bass note (one octave down, every 4th note)
      if (noteIdx % 4 === 1) {
        const bass = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.value = freq / 2;
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        bassGain.gain.linearRampToValueAtTime(0, now + 0.8);
        bass.connect(bassGain);
        bassGain.connect(this.musicGain);
        bass.start(now);
        bass.stop(now + 0.8);
      }
    };

    this.musicInterval = setInterval(playNote, 400);
  }

  stopMusic() {
    this.musicEnabled = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch {}
      this.musicGain = null;
    }
  }
}

export const audioBus = new AudioBus();

// Initialize on first user gesture (PWA-safe)
if (typeof window !== 'undefined') {
  const handler = () => {
    audioBus.init();
    audioBus.initTTS(); // Initialize TTS voices on first gesture
    // Trigger a dummy speak to unlock audio on mobile
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(u);
      }
    } catch {}
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}
