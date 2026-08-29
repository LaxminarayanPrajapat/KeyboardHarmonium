/* ============================================
   Main Application Controller
   ============================================ */

'use strict';

const App = (() => {

    // Configuration
    let mode = 'practice';           // 'practice' | 'test'
    let duration = 60;               // seconds for test mode
    let difficulty = 'medium';
    let soundEnabled = true;
    let clickEnabled = true;
    let scaleStyle = 'sargam';

    // Text pool
    let textPool = { easy: [], medium: [], hard: [] };
    let currentText = '';
    let resultShown = false;

    // DOM refs
    let els = {};

    /* ---------- Text Loading ---------- */

    async function loadTexts() {
        try {
            const res = await fetch('assets/texts.json');
            textPool = await res.json();
        } catch (e) {
            console.warn('Could not load text JSON, using fallback:', e);
            textPool = {
                easy: ['the cat sat on the mat and sang a song'],
                medium: ['the quick brown fox jumps over the lazy dog'],
                hard: ['complex sentences with punctuation, hyphens, and numbers 123!'],
            };
        }
    }

    function pickText() {
        const pool = textPool[difficulty] || textPool.medium;
        if (!pool || !pool.length) return 'the quick brown fox jumps over the lazy dog';
        let picked = pool[Math.floor(Math.random() * pool.length)];
        while (pool.length > 1 && picked === currentText) {
            picked = pool[Math.floor(Math.random() * pool.length)];
        }
        return picked;
    }

    /* ---------- Game Setup ---------- */

    let countdownActive = false;

    function startSession(passedMode) {
        mode = passedMode;
        resultShown = false;
        currentText = pickText();

        TypingEngine.setDuration(mode === 'test' ? duration : 0);
        TypingEngine.loadText(currentText);

        els.hiddenInput.value = '';
        UI.showSection(mode);
        UI.renderText(currentText, 0);
        UI.updateStats({
            wpm: 0, accuracy: 100, elapsed: 0, errors: 0,
            progress: 0, charIndex: 0,
            time: mode === 'test' ? duration : undefined
        });
        UI.clearFeedback();

        // Show 3-2-1 countdown for the timed test
        countdownActive = mode === 'test';
        if (countdownActive) {
            runCountdown(() => {
                countdownActive = false;
                els.hiddenInput.focus();
            });
        } else {
            els.hiddenInput.focus();
        }
    }

    function runCountdown(done) {
        let count = 3;
        const notes = ['pa', 'sa', 'sa'];
        const tick = () => {
            const noteName = notes[count - 1] || 'sa';
            UI.showCountdown(count, HarmoniumAudio.getColors()[noteName]);
            HarmoniumAudio.playDemoNote(noteName);
            if (count === 1) {
                setTimeout(() => {
                    UI.hideCountdown();
                    done();
                }, 700);
                return;
            }
            count--;
            setTimeout(tick, 900);
        };
        tick();
    }

    /* ---------- Keyboard Handling ---------- */

    const IGNORED_KEYS = [
        'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown', 'Escape',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9',
        'F10', 'F11', 'F12', 'Dead', 'ContextMenu', 'NumLock',
        'ScrollLock', 'PrintScreen', 'Insert', 'Delete'
    ];

    function handleKeyDown(e) {
        // Only handle when test is visible / in session
        if (UI_typingHidden()) return;
        if (countdownActive) return;

        // Enter finishes early
        if (e.key === 'Enter') {
            if (TypingEngine.running && mode === 'test') {
                e.preventDefault();
                finishSession();
            }
            return;
        }

        if (IGNORED_KEYS.includes(e.key)) return;

        const activeEl = document.activeElement;
        const isTypingContext =
            els.textDisplay === activeEl ||
            els.hiddenInput === activeEl;
        if (!isTypingContext) return;

        e.preventDefault();

        // Harmonium sound for every printable key (incl. backspace no sound)
        if (e.key === 'Backspace') {
            if (TypingEngine.finished) return;
            TypingEngine.handleBackspace();
            renderCurrentState();
            updateStatsUI();
            return;
        }

        if (e.key.length === 1) {
            const res = TypingEngine.handleChar(e.key);
            if (!res) {
                // finished silently
                if (TypingEngine.isComplete()) finishSession();
                return;
            }

            if (res.result === 'wrong') {
                // Strong warning sound for the mistake
                HarmoniumAudio.playError();
                UI.indicateError();
            } else {
                // Play the pleasant harmonium note only for correct keys
                const noteObj = HarmoniumAudio.playKeySound(e.key);
                if (noteObj) {
                    UI.shiftBackground(noteObj.note);
                    if (soundEnabled) {
                        UI.showNoteFeedback(HarmoniumAudio.getDisplayName(noteObj));
                    }
                    UI.spawnNoteParticle(noteObj.note);
                }
            }

            renderCurrentState();
            updateStatsUI();

            if (TypingEngine.isComplete()) {
                setTimeout(() => finishSession(), 250);
            }
        }
    }

    function UI_typingHidden() {
        return document.getElementById('typingSection').classList.contains('hidden');
    }

    // Re-render text with current correctness and position
    function renderCurrentState() {
        const index = TypingEngine.currentIndex;
        UI.renderText(TypingEngine.text, index, TypingEngine);
    }

    function updateStatsUI() {
        const state = TypingEngine.getState();
        UI.updateStats({
            wpm: TypingEngine.getWpm(),
            accuracy: TypingEngine.getAccuracy(),
            elapsed: state.elapsed,
            time: (mode === 'test' && state.running && !state.finished)
                ? (duration - state.elapsed)
                : undefined,
            errors: state.wrongCount,
            progress: TypingEngine.getProgress(),
            charIndex: state.charIndex,
        });
    }

    function finishSession() {
        if (resultShown) return;
        resultShown = true;
        const result = TypingEngine.finish();
        if (!result) return;
        updateStatsUI();

        if (mode === 'test' || result.complete) {
            const title = mode === 'test'
                ? '🏆 Test Complete!'
                : '🎵 Practice Complete!';
            UI.showResults(result, title);
        }
    }

    /* ---------- Timer updates ---------- */

    function tick() {
        const state = TypingEngine.getState();
        if (state.running && !state.finished) {
            updateStatsUI();
        } else if (state.finished && !resultShown) {
            // Time ran out - show the results automatically
            finishSession();
        }
    }

    /* ---------- Events ---------- */

    function bindEvents() {
        // Nav switching - shows the matching page content
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const nav = btn.dataset.nav;
                if (nav === 'practice' || nav === 'test') {
                    UI.showHero(nav);
                    els.hiddenInput.blur();
                }
            });
        });

        // In-session nav click: stop current session and go back to that page
        // (handled above since nav always returns to hero)

        // Hero buttons
        document.getElementById('startPracticeBtn').addEventListener('click', () => {
            startSession('practice');
        });

        document.getElementById('takeTestBtn').addEventListener('click', () => {
            startSession('test');
        });

        // Duration control on Test page
        document.querySelectorAll('#testDurationControl button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#testDurationControl button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                duration = parseInt(btn.dataset.value, 10);
                syncSettingsDuration(duration);
            });
        });

        // Difficulty control on Test page
        document.querySelectorAll('#testDifficultyControl button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#testDifficultyControl button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                difficulty = btn.dataset.value;
                syncSettingsDifficulty(difficulty);
            });
        });

        // Restart
        document.getElementById('restartBtn').addEventListener('click', () => {
            startSession(mode);
        });

        // Results modal
        document.getElementById('tryAgainBtn').addEventListener('click', () => {
            UI.hideResults();
            startSession(mode);
        });

        document.getElementById('newTextBtn').addEventListener('click', () => {
            UI.hideResults();
            currentText = '';
            startSession(mode);
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            UI.hideResults();
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            UI.showSettings();
        });

        document.getElementById('settingsClose').addEventListener('click', () => {
            UI.hideSettings();
        });

        // Duration control (settings modal)
        document.querySelectorAll('#durationControl button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#durationControl button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                duration = parseInt(btn.dataset.value, 10);
                syncTestPageDuration(duration);
            });
        });

        // Difficulty control (settings modal)
        document.querySelectorAll('#difficultyControl button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#difficultyControl button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                difficulty = btn.dataset.value;
                syncTestPageDifficulty(difficulty);
            });
        });

        // Sound toggles
        const soundOnToggle = document.getElementById('soundOnToggle');
        soundOnToggle.addEventListener('change', () => {
            soundEnabled = soundOnToggle.checked;
            HarmoniumAudio.setSoundEnabled(soundEnabled);
            syncSoundIcon();
        });

        const clickToggle = document.getElementById('clickSoundToggle');
        clickToggle.addEventListener('change', () => {
            clickEnabled = clickToggle.checked;
            HarmoniumAudio.setClickEnabled(clickEnabled);
        });

        // Scale style
        document.querySelectorAll('#scaleStyleControl button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#scaleStyleControl button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                scaleStyle = btn.dataset.value;
                HarmoniumAudio.setScaleStyle(scaleStyle);
            });
        });

        // Header sound toggle
        document.getElementById('soundToggle').addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            HarmoniumAudio.setSoundEnabled(soundEnabled);
            document.getElementById('soundOnToggle').checked = soundEnabled;
            syncSoundIcon();
        });

        // Modal overlay clicks
        document.getElementById('resultsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('resultsModal')) UI.hideResults();
        });

        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('settingsModal')) UI.hideSettings();
        });

        // Focus typing display
        els.textDisplay.addEventListener('click', () => {
            els.hiddenInput.focus();
        });

        // Global keyboard
        document.addEventListener('keydown', handleKeyDown);

        // Stats ticker
        setInterval(tick, 500);

        UI.setupHarmoniumVisual();
    }

    function syncSoundIcon() {
        const btn = document.getElementById('soundToggle');
        btn.classList.toggle('sound-off', !soundEnabled);
        btn.textContent = soundEnabled ? '🔊' : '🔇';
    }

    function syncTestPageDuration(val) {
        const btns = document.querySelectorAll('#testDurationControl button');
        btns.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.value, 10) === val);
        });
    }

    function syncTestPageDifficulty(val) {
        const btns = document.querySelectorAll('#testDifficultyControl button');
        btns.forEach(b => {
            b.classList.toggle('active', b.dataset.value === val);
        });
    }

    function syncSettingsDuration(val) {
        const btns = document.querySelectorAll('#durationControl button');
        btns.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.value, 10) === val);
        });
    }

    function syncSettingsDifficulty(val) {
        const btns = document.querySelectorAll('#difficultyControl button');
        btns.forEach(b => {
            b.classList.toggle('active', b.dataset.value === val);
        });
    }

    /* ---------- Init ---------- */

    async function init() {
        els = {
            textDisplay: document.getElementById('textDisplay'),
            hiddenInput: document.getElementById('hiddenInput'),
            typingSection: document.getElementById('typingSection'),
        };

        UI.init();
        HarmoniumAudio.setSoundEnabled(soundEnabled);
        HarmoniumAudio.setClickEnabled(clickEnabled);

        await loadTexts();
        bindEvents();

        document.getElementById('soundOnToggle').checked = soundEnabled;
        document.getElementById('clickSoundToggle').checked = clickEnabled;
        syncSoundIcon();

        // Gentle ambient particles on the hero
        setInterval(() => {
            if (document.getElementById('typingSection').classList.contains('hidden')) {
                const notes = ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'];
                UI.spawnNoteParticle(notes[Math.floor(Math.random() * notes.length)]);
            }
        }, 3000);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);