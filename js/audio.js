/* ============================================
   Harmonium Sound Engine
   Web Audio API synthesis mimicking a harmonium
   ============================================ */

'use strict';

const HarmoniumAudio = (() => {

    let audioCtx = null;
    let masterGain = null;
    let soundEnabled = true;
    let clickEnabled = true;
    let scaleStyle = 'sargam';

    // Indian Sargam scale (Sa Re Ga Ma Pa Dha Ni) based on C major / G sa-pa
    // Harmonium uses equal temperament; base Sa = C#4 (middle octave)
    const SA_BASE = 269.29; // C#4 as Sa

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

    // Western note names for display
    const NOTE_NAMES = {
        sa: { sargam: 'सा', western: 'C#' },
        re: { sargam: 'रे', western: 'D#' },
        ga: { sargam: 'गा', western: 'F' },
        ma: { sargam: 'मा', western: 'F#' },
        pa: { sargam: 'पा', western: 'G#' },
        dha: { sargam: 'धा', western: 'A#' },
        ni: { sargam: 'नी', western: 'C' },
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
        return SA_BASE * Math.pow(SEMITONE, semitone);
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

    // Soft percussive click for keydown (tactile feel)
    function playClick() {
        if (!clickEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 1600 + Math.random() * 300;

        const gain = audioCtx.createGain();
        const clickGain = audioCtx.createGain();
        clickGain.gain.value = 0.05;

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

        osc.connect(gain);
        gain.connect(clickGain);
        clickGain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    // Strong heavy warning sound on typing error - deep, harsh, alarming
    function playErrorSound() {
        if (!soundEnabled || !audioCtx) return;

        const now = audioCtx.currentTime;

        // Dense, dark frequency cluster (low dissonant beating)
        // 233 Hz + 220 Hz = minor second, very "wrong" feeling
        const cluster = [
            { freq: 220, type: 'sawtooth', amp: 0.42 },
            { freq: 233, type: 'square',   amp: 0.30 },
        ];

        // Distortion shaper for a harsh, screaming edge
        const shaper = audioCtx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = Math.tanh(x * 3.2);
        }
        shaper.curve = curve;

        cluster.forEach(({ freq, type, amp }) => {
            const osc = audioCtx.createOscillator();
            osc.type = type;
            osc.frequency.value = freq;

            // Deep, slow vibrato for tense alarm wobble
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 7;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 6;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.value = freq * 1.005; // slight detune = rough chorus

            // Heavy, hard-hitting envelope: punchy attack, long angry decay
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(amp, now + 0.006);
            gain.gain.setTargetAtTime(0.0001, now + 0.12, 0.16);

            osc.connect(shaper);
            osc2.connect(shaper);
            shaper.connect(gain);
            gain.connect(masterGain);

            osc.start(now);
            osc.stop(now + 0.7);
            osc2.start(now);
            osc2.stop(now + 0.7);
            lfo.start(now);
            lfo.stop(now + 0.7);
        });

        // Extra deep sub-layer for body/weight
        const sub = audioCtx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 55;
        const subGain = audioCtx.createGain();
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
        subGain.gain.setTargetAtTime(0.0001, now + 0.15, 0.18);
        sub.connect(subGain);
        subGain.connect(masterGain);
        sub.start(now);
        sub.stop(now + 0.7);
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
                playHarmonic(note);
            }
            playClick();
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

        setSoundEnabled(on) {
            soundEnabled = on;
        },

        setClickEnabled(on) {
            clickEnabled = on;
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