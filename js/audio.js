/* ============================================
   Harmonium Sound Engine
   Web Audio API synthesis mimicking a harmonium
   ============================================ */

'use strict';

const HarmoniumAudio = (() => {

    let audioCtx = null;
    let masterGain = null;
    let soundEnabled = true;
    let scaleStyle = 'sargam';

    // Harmonium base: Indian scale Sa = C#4 (middle octave)
    const SA_BASE = 269.29;

    // Western base: Sa becomes C4 - the natural do-re-mi scale
    const C4_BASE = 261.63;

    const SEMITONE = 1.0594630943592953; // 2^(1/12)

    // Scale intervals (semitones from Sa) - Bilawal (major) thaat
    const SARGAM = {
        'sa': 0,    // Sa  - Do
        're': 2,    // Re  - Re
        'ga': 4,    // Ga  - Mi
        'ma': 5,    // Ma  - Fa
        'pa': 7,    // Pa  - So
        'dha': 9,   // Dha - La
        'ni': 11,   // Ni  - Ti
    };

    // Note names for display (Indian sargam or western note letter)
    const NOTE_NAMES = {
        sa: { sargam: 'सा', western: 'C' },
        re: { sargam: 'रे', western: 'D' },
        ga: { sargam: 'गा', western: 'E' },
        ma: { sargam: 'मा', western: 'F' },
        pa: { sargam: 'पा', western: 'G' },
        dha: { sargam: 'धा', western: 'A' },
        ni: { sargam: 'नी', western: 'B' },
    };

    // Color for each note (used by UI)
    const NOTE_COLORS = {
        sa: '#ff4757',
        re: '#ff8c42',
        ga: '#ffd32a',
        ma: '#26de81',
        pa: '#20bfe6',
        dha: '#5f27cd',
        ni: '#fd79a8',
    };

    // Harmonium-resonant frequency multiples (harmonics)
    // Harmonium has strong 2nd harmonic + slight beating
    const HARMONICS = [
        { mult: 1,    amp: 1.0 },
        { mult: 2,    amp: 0.55 },
        { mult: 3,    amp: 0.18 },
        { mult: 4,    amp: 0.08 },
    ];

    // Key -> note mapping for the alphabet keys (three rows)
    const KEY_NOTE_MAP = {
        // Middle row (A-L) - the main Sa octave
        'a': { note: 'ma', octave: 0 },   // Sa
        's': { note: 're', octave: 0 },   // Re
        'd': { note: 'ga', octave: 0 },   // Ga
        'f': { note: 'ma', octave: 0 },   // Ma
        'g': { note: 'pa', octave: 0 },   // Pa
        'h': { note: 'dha', octave: 0 },  // Dha
        'j': { note: 'ni', octave: 0 },   // Ni
        'k': { note: 'sa', octave: 1 },   // Sa' upper
        'l': { note: 're', octave: 1 },   // Re' upper

        // Top row (Q-P) - lower octave
        'q': { note: 'sa', octave: -1 },
        'w': { note: 're', octave: -1 },
        'e': { note: 'ga', octave: -1 },
        'r': { note: 'ma', octave: -1 },
        't': { note: 'pa', octave: -1 },
        'y': { note: 'dha', octave: -1 },
        'u': { note: 'ni', octave: -1 },
        'i': { note: 'sa', octave: 0 },
        'o': { note: 're', octave: 0 },
        'p': { note: 'ga', octave: 0 },

        // Bottom row (Z-M) - upper octave
        'z': { note: 'sa', octave: 1 },
        'x': { note: 're', octave: 1 },
        'c': { note: 'ga', octave: 1 },
        'v': { note: 'ma', octave: 1 },
        'b': { note: 'pa', octave: 1 },
        'n': { note: 'dha', octave: 1 },
        'm': { note: 'ni', octave: 1 },
    };

    // Extended mapping for digits/punctuation to act as extra notes
    const EXTRA_KEY_NOTES = {
        '1': 'sa', '2': 're', '3': 'ga', '4': 'ma', '5': 'pa',
        '6': 'dha', '7': 'ni', '8': 'sa', '9': 're', '0': 'ga',
        ' ': 'pa',
    };

    let lastPlayed = null;    // Prevent duplicate sound on key repeat
    let audioNodes = new Set();

    /* ---------- Helpers ---------- */

    function getFrequency(note, octave) {
        const semitone = SARGAM[note] + (octave * 12);
        const base = scaleStyle === 'western' ? C4_BASE : SA_BASE;
        return base * Math.pow(SEMITONE, semitone);
    }

    function getKeyNote(key) {
        const k = key.toLowerCase();
        if (KEY_NOTE_MAP[k]) return KEY_NOTE_MAP[k];
        if (EXTRA_KEY_NOTES[k] !== undefined) {
            return { note: EXTRA_KEY_NOTES[k], octave: 0 };
        }
        return null;
    }

    function displayName(note) {
        const n = NOTE_NAMES[note.note];
        if (!n) return '';
        const name = scaleStyle === 'sargam' ? n.sargam : n.western;
        if (note.octave > 0) return name + '˙';
        if (note.octave < 0) return '˙' + name;
        return name;
    }

    /* ---------- Audio Context Management ---------- */

    function init() {
        if (audioCtx) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            return;
        }
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                console.warn('Web Audio API not supported');
                return;
            }
            audioCtx = new AudioCtx();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.5;
            masterGain.connect(audioCtx.destination);

            // Gentle reverb for space (using convolver-generated impulse)
            try {
                const convolver = audioCtx.createConvolver();
                convolver.buffer = createImpulseResponse(1.2, 1.6);
                const wet = audioCtx.createGain();
                wet.gain.value = 0.18;
                convolver.connect(wet);
                wet.connect(audioCtx.destination);
                masterGain.disconnect();
                masterGain.connect(convolver);
                masterGain.connect(audioCtx.destination);
                dryMaster = masterGain;
            } catch (e) {
                // reverb setup failed, just keep dry
            }

        } catch (e) {
            console.warn('Could not initialize audio:', e);
        }
    }

    // Create short noise-based impulse response for reverb
    function createImpulseResponse(duration, decay) {
        const rate = audioCtx.sampleRate;
        const length = Math.floor(rate * duration);
        const impulse = audioCtx.createBuffer(2, length, rate);
        for (let c = 0; c < 2; c++) {
            const data = impulse.getChannelData(c);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    /* ---------- Harmonium Note Synthesis ---------- */

    function playNote(noteObj, velocity = 1) {
        if (!soundEnabled || !audioCtx) return;

        if (scaleStyle === 'western') return playWesternNote(noteObj, velocity);
        return playHarmoniumNote(noteObj, velocity);
    }

    // Indian harmonium reed tone - sawtooth + harmonics through a mellow lowpass
    function playHarmoniumNote(noteObj, velocity) {
        const now = audioCtx.currentTime;
        const freq = getFrequency(noteObj.note, noteObj.octave);

        // Add slight detuning human feel
        const detune = (Math.random() - 0.5) * 3;

        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        // Shaping with harmonics for reed-like tone
        const gain = audioCtx.createGain();

        // Harmonium connection to a lowpass filter for mellow character
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq * 6;
        filter.Q.value = 0.7;

        // Envelope: harmonium has fast attack, medium sustain, gentle decay
        const peak = 0.32 * velocity;
        const attackTime = 0.012;
        const decayTime = 0.15;
        const sustainLevel = 0.6;
        const releaseTime = 0.55;

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + attackTime);
        gain.gain.setTargetAtTime(peak * sustainLevel, now + attackTime + decayTime, 0.18);
        gain.gain.setTargetAtTime(0.0001, now + attackTime + decayTime + 0.02, releaseTime / 3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        // Release naturally; stop after ~1s
        osc.stop(now + 1.2);

        // Track for cleanup
        audioNodes.add(gain);
        gain.onended = () => {
            filter.disconnect();
            gain.disconnect();
            audioNodes.delete(gain);
        };

        return { freq, osc, gain };
    }

    // Western music-box / celesta tone - bright plucked bells with a long warm tail
    function playWesternNote(noteObj, velocity) {
        const now = audioCtx.currentTime;
        const freq = getFrequency(noteObj.note, noteObj.octave);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.3 * velocity, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        // Glossy sine stack: fundamental + octave + two-octave bell shimmer
        const osc1 = audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = freq;

        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        const g2 = audioCtx.createGain();
        g2.gain.value = 0.32;

        const bell = audioCtx.createOscillator();
        bell.type = 'sine';
        bell.frequency.value = freq * 4;
        const gBell = audioCtx.createGain();
        gBell.gain.value = 0.1;

        // Remove mud below the fundamental octave
        const high = audioCtx.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = 80;

        osc1.connect(gain);
        osc2.connect(g2);
        g2.connect(gain);
        bell.connect(gBell);
        gBell.connect(gain);
        gain.connect(high);
        high.connect(masterGain);

        osc1.start(now);
        osc1.stop(now + 1.3);
        osc2.start(now);
        osc2.stop(now + 1.1);
        bell.start(now);
        bell.stop(now + 0.9);

        audioNodes.add(gain);
        gain.onended = () => {
            high.disconnect();
            gain.disconnect();
            audioNodes.delete(gain);
        };

        return { freq, osc: osc1, gain };
    }

    // Add a subtle bell-like melodic overtone (optional flourish)
    function playHarmonic(noteObj, velocity = 1) {
        if (!soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const freq = getFrequency(noteObj.note, noteObj.octave) * 2;

        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06 * velocity, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
    }

    // Comedic "Fhaaa" meme clip on typing error - plays the real sound sample
    let fhaahAudio = null;

    function getFhaahAudio() {
        if (!fhaahAudio) {
            fhaahAudio = new Audio('assets/faaah.mp3');
            fhaahAudio.preload = 'auto';
            fhaahAudio.volume = 0.9;
        }
        return fhaahAudio;
    }

    // Call during a real user gesture (e.g. level click) so browsers that
    // block autoplay-with-sound unlock this element for later playback.
    function unlockErrorAudio() {
        if (!soundEnabled) return;
        const a = getFhaahAudio();
        try {
            a.muted = true;
            const p = a.play();
            if (p) {
                p.then(() => {
                    a.pause();
                    a.currentTime = 0;
                    a.muted = false;
                }).catch(() => { a.muted = false; });
            }
        } catch (e) { /* ignore unlock failures */ }
    }

    function playErrorSound() {
        if (!soundEnabled) return;

        const a = getFhaahAudio();
        // Let an in-progress Fhaah play out; don't restart it from the intro
        // on every rapid wrong keystroke.
        if (!a.paused) return;

        try {
            // Restart the clip from the beginning
            a.currentTime = 0;
            const p = a.play();
            if (p) {
                p.catch(err => {
                    console.warn('Fhaaa mp3 blocked, using synth fallback:', err);
                    synthWailFallback();
                });
            } else {
                synthWailFallback();
            }
        } catch (e) {
            console.warn('Could not play error sound:', e);
            synthWailFallback();
        }
    }

    // Guaranteed-to-play Web Audio wail (same pipeline as the harmonium notes).
    // Used if the browser blocks the mp3 element's playback.
    function synthWailFallback() {
        init();
        if (!audioCtx) return;

        const now = audioCtx.currentTime;
        const dur = 0.9;

        const voice = audioCtx.createOscillator();
        voice.type = 'sawtooth';
        voice.frequency.setValueAtTime(430, now);
        voice.frequency.exponentialRampToValueAtTime(540, now + 0.1);
        voice.frequency.setTargetAtTime(350, now + 0.2, 0.22);

        const voice2 = audioCtx.createOscillator();
        voice2.type = 'square';
        voice2.frequency.setValueAtTime(433, now);
        voice2.frequency.exponentialRampToValueAtTime(543, now + 0.1);
        voice2.frequency.setTargetAtTime(353, now + 0.2, 0.22);

        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 6;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 28;
        lfo.connect(lfoGain);
        lfoGain.connect(voice.frequency);
        lfoGain.connect(voice2.frequency);

        const formant = audioCtx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = 950;
        formant.Q.value = 1.2;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.5, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        voice.connect(formant);
        voice2.connect(formant);
        formant.connect(gain);
        gain.connect(masterGain);

        voice.start(now);
        voice.stop(now + dur + 0.05);
        voice2.start(now);
        voice2.stop(now + dur + 0.05);
        lfo.start(now);
        lfo.stop(now + dur + 0.05);

        audioNodes.add(gain);
        gain.onended = () => {
            formant.disconnect();
            gain.disconnect();
            audioNodes.delete(gain);
        };
    }

    /* ---------- Public API ---------- */

    return {
        init,

        playKeySound(key) {
            if (!soundEnabled) return null;
            init();
            const note = getKeyNote(key);
            if (note) {
                playNote(note);
                if (scaleStyle !== 'western') playHarmonic(note);
            }
            return note;
        },

        playDemoNote(noteName) {
            if (!soundEnabled) return;
            init();
            const note = { note: noteName, octave: 0 };
            playNote(note, 1.2);
            playHarmonic(note, 1.2);
        },

        playError: playErrorSound,
        unlockErrorAudio,

        setSoundEnabled(on) {
            soundEnabled = on;
        },

        setScaleStyle(style) {
            scaleStyle = style;
        },

        isReady() {
            return !!audioCtx;
        },

        getDisplayName(noteObj) {
            return displayName(noteObj);
        },

        getKeyNote,
        getColors: () => NOTE_COLORS,
    };

})();