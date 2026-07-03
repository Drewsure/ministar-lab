/**
 * Living Textbook — Prototype Game Framework
 * ============================================
 *
 * Shared contract layer for all prototype game modules.
 * Provides:
 *   - EventLogger: emits the 6 standard events (game_started, round_shown,
 *     answer_submitted, answer_result, game_completed, mastery_updated)
 *   - AudioBus: TTS (Web Speech API) + optional audio URL playback
 *   - InputValidator: validates JSON input shape before game starts
 *
 * HARD CONSTRAINTS ENFORCED HERE:
 *   - 8-12 vocabulary terms (constraint #7)
 *   - Exactly 2 sentence structures (constraint #8)
 *   - All learner-facing text has audio support (constraint #2)
 *   - No gambling-like reward mechanics (constraint #11)
 *
 * USAGE (in a prototype's index.html):
 *   <script src="../_shared/prototype-framework.js"></script>
 *   <script>
 *     const game = new VocabTapMatch('#root', inputData, {
 *       onEvent: (event) => console.log('EMITTED:', event),
 *     });
 *     game.start();
 *   </script>
 *
 * This file is dependency-free vanilla JS. Runs in any modern browser.
 * No build step required.
 */

(function (global) {
  'use strict';

  // ===========================================================================
  // EventLogger — emits standard events to a callback + keeps an audit log.
  // Every event has: type, timestamp (ms since game start), sessionToken.
  // ===========================================================================

  const STANDARD_EVENTS = [
    'game_started',
    'round_shown',
    'answer_submitted',
    'answer_result',
    'game_completed',
    'mastery_updated',
  ];

  class EventLogger {
    constructor(sessionToken, onEvent) {
      this.sessionToken = sessionToken;
      this.onEvent = onEvent || function () {};
      this.startTime = 0;
      this.log = [];
    }

    start() {
      this.startTime = Date.now();
    }

    emit(partial) {
      if (STANDARD_EVENTS.indexOf(partial.type) === -1) {
        console.warn('[EventLogger] Non-standard event type:', partial.type);
      }
      const event = Object.assign(
        {
          timestamp: Date.now() - this.startTime,
          sessionToken: this.sessionToken,
        },
        partial
      );
      this.log.push(event);
      try {
        this.onEvent(event);
      } catch (e) {
        console.error('[EventLogger] onEvent callback error:', e);
      }
      // Also log to console for prototype debugging
      console.log('[EVENT]', event.type, event);
    }

    getAll() {
      return this.log.slice();
    }
  }

  // ===========================================================================
  // AudioBus — TTS for all learner-facing text + optional audio URL playback.
  //
  // CONSTRAINT #2: All learner-facing text must have audio support.
  // CONSTRAINT #3: Prefer tap/click text to hear it.
  // CONSTRAINT #4: If text is also an action button, add a separate listen
  //   control. We expose makeSpeakable(el, text) and makeListenButton(text).
  // ===========================================================================

  class AudioBus {
    constructor() {
      this.ttsEnabled = true;
      this.ttsVoice = null;
      this.ttsVoiceReady = false;
      this.currentUtterance = null;
      this.muted = false;
      this._initTTS();
    }

    _initTTS() {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;
        this.ttsVoice =
          voices.find((v) => v.lang === 'en-US' && /google us english|natural|enhanced/i.test(v.name)) ||
          voices.find((v) => v.lang === 'en-US') ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
        this.ttsVoiceReady = true;
      };
      pickVoice();
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }

    /** Speak text aloud. Cancels any in-progress speech. */
    speak(text, opts) {
      opts = opts || {};
      if (!this.ttsEnabled || this.muted) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const clean = String(text)
          .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!clean) return;
        const utter = new SpeechSynthesisUtterance(clean);
        // Use opts.lang if provided (from audio_cues), else voice lang, else en-US
        utter.lang = opts.lang || (this.ttsVoice ? this.ttsVoice.lang : 'en-US');
        utter.rate = opts.rate || 0.92;
        utter.pitch = opts.pitch || 1.05;
        utter.volume = opts.volume != null ? opts.volume : 1.0;
        if (!opts.lang && this.ttsVoice) utter.voice = this.ttsVoice;
        this.currentUtterance = utter;
        utter.onend = () => { this.currentUtterance = null; };
        utter.onerror = () => { this.currentUtterance = null; };
        window.speechSynthesis.speak(utter);
      } catch (e) {
        // TTS not available — fail silently
      }
    }

    /** Play an audio file URL (for pre-recorded term/sentence audio). */
    playUrl(url) {
      if (!url || this.muted) return;
      try {
        const audio = new Audio(url);
        audio.play().catch(function () {});
      } catch (e) {}
    }

    /** Speak a term — prefer audioUrl if provided, else TTS the term text. */
    speakTerm(term) {
      if (term.audioUrl) {
        this.playUrl(term.audioUrl);
      } else {
        this.speak(term.term);
      }
    }

    /**
     * Speak using an audio_cues lookup table.
     * If a cue with matching text + kind exists and has an `audioUrl`, play that.
     * Otherwise, fall back to TTS.
     *
     * @param {string} text - The text to speak
     * @param {string} kind - 'term' | 'sentence' | 'instruction'
     * @param {Array} audioCues - The audio_cues array from the input JSON
     * @param {object} opts - TTS options (rate, pitch, etc.)
     */
    speakWithCues(text, kind, audioCues, opts) {
      if (audioCues && Array.isArray(audioCues)) {
        const cue = audioCues.find(function (c) {
          return c.text === text && (!c.kind || c.kind === kind);
        });
        if (cue && cue.audioUrl) {
          this.playUrl(cue.audioUrl);
          return;
        }
      }
      // Fall back to TTS — use the cue's language if available
      const langCue = audioCues && audioCues.find(function (c) { return c.text === text; });
      const lang = (langCue && langCue.language) || null;
      this.speak(text, Object.assign({ lang: lang }, opts || {}));
    }

    stopSpeaking() {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }

    setMuted(muted) {
      this.muted = muted;
      if (muted) this.stopSpeaking();
    }
  }

  // ===========================================================================
  // InputValidator — validates JSON input before game starts.
  // Enforces: 8-12 terms, exactly 2 sentence structures, required fields.
  // ===========================================================================

  class InputValidator {
    /**
     * @returns {{ valid: boolean, errors: string[], data: object }}
     */
    static validate(data) {
      const errors = [];
      if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Input must be a JSON object'], data: null };
      }
      // Terms
      if (!Array.isArray(data.terms)) {
        errors.push('`terms` must be an array');
      } else {
        if (data.terms.length < 8 || data.terms.length > 12) {
          errors.push('`terms` must contain 8-12 items (got ' + data.terms.length + ')');
        }
        data.terms.forEach(function (t, i) {
          if (!t.id) errors.push('terms[' + i + '].id is required');
          if (!t.term) errors.push('terms[' + i + '].term is required');
          if (!t.definition) errors.push('terms[' + i + '].definition is required');
        });
      }
      // Sentence structures
      if (!Array.isArray(data.sentenceStructures)) {
        errors.push('`sentenceStructures` must be an array');
      } else {
        if (data.sentenceStructures.length !== 2) {
          errors.push('`sentenceStructures` must contain exactly 2 items (got ' + data.sentenceStructures.length + ')');
        }
        data.sentenceStructures.forEach(function (s, i) {
          if (!s.id) errors.push('sentenceStructures[' + i + '].id is required');
          if (!s.template) errors.push('sentenceStructures[' + i + '].template is required');
          if (s.template.indexOf('{term}') === -1) {
            errors.push('sentenceStructures[' + i + '].template must contain {term} placeholder');
          }
        });
      }
      // Tenant (optional but recommended)
      if (data.tenant && (!data.tenant.id || !data.tenant.displayName)) {
        errors.push('`tenant.id` and `tenant.displayName` are required when tenant is provided');
      }
      return { valid: errors.length === 0, errors: errors, data: data };
    }

    /**
     * Validates the Sentence Builder schema (unit_meta + pedagogical_payload + audio_cues).
     * Used by Prototype 02+.
     * @returns {{ valid: boolean, errors: string[], data: object }}
     */
    static validateSentenceBuilder(data) {
      const errors = [];
      if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Input must be a JSON object'], data: null };
      }
      // unit_meta
      if (!data.unit_meta || typeof data.unit_meta !== 'object') {
        errors.push('`unit_meta` is required and must be an object');
      } else {
        const um = data.unit_meta;
        if (!um.tenant_id) errors.push('`unit_meta.tenant_id` is required (constraint #1: no hard-coded tenant)');
        if (!um.game_mode) errors.push('`unit_meta.game_mode` is required');
        if (typeof um.level !== 'number') errors.push('`unit_meta.level` must be a number');
      }
      // pedagogical_payload
      if (!data.pedagogical_payload || typeof data.pedagogical_payload !== 'object') {
        errors.push('`pedagogical_payload` is required and must be an object');
      } else {
        const pp = data.pedagogical_payload;
        if (!Array.isArray(pp.vocabulary_terms)) {
          errors.push('`pedagogical_payload.vocabulary_terms` must be an array');
        } else {
          if (pp.vocabulary_terms.length < 8 || pp.vocabulary_terms.length > 12) {
            errors.push('`vocabulary_terms` must contain 8-12 items (got ' + pp.vocabulary_terms.length + ')');
          }
          pp.vocabulary_terms.forEach(function (t, i) {
            if (typeof t !== 'string' || t.length === 0) {
              errors.push('vocabulary_terms[' + i + '] must be a non-empty string');
            }
          });
        }
        if (!Array.isArray(pp.target_sentences)) {
          errors.push('`pedagogical_payload.target_sentences` must be an array');
        } else {
          if (pp.target_sentences.length !== 2) {
            errors.push('`target_sentences` must contain exactly 2 items (got ' + pp.target_sentences.length + ')');
          }
          pp.target_sentences.forEach(function (s, i) {
            if (typeof s !== 'string' || s.length === 0) {
              errors.push('target_sentences[' + i + '] must be a non-empty string');
            }
          });
        }
      }
      // audio_cues (optional but recommended — constraint #2)
      if (data.audio_cues !== undefined) {
        if (!Array.isArray(data.audio_cues)) {
          errors.push('`audio_cues` must be an array if provided');
        } else {
          data.audio_cues.forEach(function (c, i) {
            if (!c.kind) errors.push('audio_cues[' + i + '].kind is required (term|sentence|instruction)');
            if (!c.text) errors.push('audio_cues[' + i + '].text is required');
            if (!c.language) errors.push('audio_cues[' + i + '].language is required');
          });
        }
      }
      return { valid: errors.length === 0, errors: errors, data: data };
    }
  }

  // ===========================================================================
  // MasteryTracker — tracks per-term mastery (0.0 to 1.0).
  // Emits mastery_updated events when mastery changes.
  // NO gambling mechanics — mastery is purely a function of correct/incorrect.
  // ===========================================================================

  class MasteryTracker {
    constructor(termIds, eventLogger) {
      this.mastery = {};
      termIds.forEach((id) => { this.mastery[id] = 0; });
      this.eventLogger = eventLogger;
    }

    /** Record a correct answer → mastery += 0.15 (capped at 1.0). */
    recordCorrect(termId) {
      const prev = this.mastery[termId] || 0;
      const next = Math.min(1.0, prev + 0.15);
      this.mastery[termId] = next;
      this.eventLogger.emit({
        type: 'mastery_updated',
        termId: termId,
        previousMastery: prev,
        newMastery: next,
        delta: next - prev,
      });
    }

    /** Record an incorrect answer → mastery -= 0.1 (floored at 0.0). */
    recordIncorrect(termId) {
      const prev = this.mastery[termId] || 0;
      const next = Math.max(0.0, prev - 0.1);
      this.mastery[termId] = next;
      this.eventLogger.emit({
        type: 'mastery_updated',
        termId: termId,
        previousMastery: prev,
        newMastery: next,
        delta: next - prev,
      });
    }

    get(termId) {
      return this.mastery[termId] || 0;
    }

    getAll() {
      return Object.assign({}, this.mastery);
    }
  }

  // ===========================================================================
  // UI Helpers — mobile-first layout primitives.
  // No premium polish. Clean divs, readable fonts, big tap targets (44px min).
  // ===========================================================================

  const UI = {
    /** Create a tap-to-speak text element. Tap anywhere on it to hear the text. */
    makeSpeakable(el, speakText, audioBus) {
      el.classList.add('ltb-speakable');
      el.dataset.speakText = speakText || el.textContent;
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        audioBus.speak(el.dataset.speakText);
      });
      return el;
    },

    /** Create a separate "Listen" button (🔊) for action-button text. */
    makeListenButton(speakText, audioBus) {
      const btn = document.createElement('button');
      btn.className = 'ltb-listen-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Listen: ' + speakText);
      btn.textContent = '🔊';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        audioBus.speak(speakText);
      });
      return btn;
    },

    /** Apply base mobile-first CSS to a root container. */
    applyBaseStyles(rootEl) {
      const style = document.createElement('style');
      style.textContent = `
        .ltb-root {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 480px;
          margin: 0 auto;
          padding: 16px;
          box-sizing: border-box;
          min-height: 100vh;
          background: #f8f9fa;
          color: #1a1a1a;
          -webkit-text-size-adjust: 100%;
        }
        .ltb-root * { box-sizing: border-box; }
        .ltb-speakable {
          cursor: pointer;
          -webkit-tap-highlight-color: rgba(0,0,0,0.1);
          border-radius: 4px;
          padding: 2px 4px;
          margin: -2px -4px;
          transition: background 0.15s;
        }
        .ltb-speakable:hover, .ltb-speakable:active {
          background: rgba(0,0,0,0.06);
        }
        .ltb-listen-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          min-width: 36px;
          border: 1px solid #d0d0d0;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          font-size: 18px;
          margin-left: 8px;
          vertical-align: middle;
          -webkit-tap-highlight-color: transparent;
        }
        .ltb-listen-btn:hover { background: #f0f0f0; }
        .ltb-card {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .ltb-button {
          display: block;
          width: 100%;
          padding: 14px 16px;
          min-height: 48px;
          border: 2px solid #2563eb;
          border-radius: 8px;
          background: #fff;
          color: #2563eb;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          margin-bottom: 8px;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.1s;
        }
        .ltb-button:hover { background: #f0f5ff; }
        .ltb-button.correct { background: #dcfce7; border-color: #16a34a; color: #16a34a; }
        .ltb-button.incorrect { background: #fee2e2; border-color: #dc2626; color: #dc2626; }
        .ltb-button:disabled { opacity: 0.6; cursor: default; }
        .ltb-prompt {
          font-size: 18px;
          font-weight: 600;
          line-height: 1.4;
          margin-bottom: 16px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .ltb-progress {
          font-size: 14px;
          color: #666;
          margin-bottom: 12px;
        }
        .ltb-feedback {
          font-size: 16px;
          font-weight: 600;
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          text-align: center;
        }
        .ltb-feedback.correct { background: #dcfce7; color: #16a34a; }
        .ltb-feedback.incorrect { background: #fee2e2; color: #dc2626; }
        .ltb-feedback.neutral { background: #e0e7ff; color: #4338ca; }
      `;
      document.head.appendChild(style);
    },

    /** Generate a unique session token. */
    generateSessionToken() {
      return 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    },

    /** Shuffle an array (Fisher-Yates). Returns a new array. */
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    },
  };

  // ===========================================================================
  // Export
  // ===========================================================================

  global.LTB = {
    EventLogger: EventLogger,
    AudioBus: AudioBus,
    InputValidator: InputValidator,
    MasteryTracker: MasteryTracker,
    UI: UI,
    STANDARD_EVENTS: STANDARD_EVENTS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
