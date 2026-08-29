/* ============================================
   Main Application Controller
   ============================================ */

'use strict';

const App = (() => {

    // Level key -> display label
    const LEVELS = {
        easy: { label: 'Easy Peasy', hint: 'Simple lowercase sentences — no punctuation.' },
        mid:  { label: 'Middle Ground', hint: 'Lowercase with punctuation to keep you sharp.' },
        beast:{ label: 'Beast', hint: 'Proper case, full punctuation, longer paragraphs.' },
        nums: { label: 'Numbers', hint: 'Random digits — get those number-row fingers moving!' },
    };

    let soundEnabled = true;
    let scaleStyle = 'sargam';

    // Text pool + current level/text
    let textPool = { easy: [], mid: [], beast: [], nums: [] };
    let currentLevel = 'easy';
    let currentText = '';
    let resultShown = false;

    // DOM refs
    let els = {};

    /* ---------- Text Loading ---------- */

    async function loadTexts() {
        try {
            const res = await fetch('assets/texts.json');
            if (res.ok) {
                const data = await res.json();
                if (isValidPool(data)) {
                    textPool = data;
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not fetch text JSON, using embedded pool:', e);
        }
        if (isValidPool(window.TEXTS_POOL)) {
            textPool = window.TEXTS_POOL;
        }
    }

    function isValidPool(pool) {
        return pool && ['easy', 'mid', 'beast', 'nums'].every(k =>
            Array.isArray(pool[k]) && pool[k].some(t => typeof t === 'string' && t.length >= 500)
        );
    }

    function pickText() {
        const pool = textPool[currentLevel];
        if (!pool || !pool.length) return 'the cat sat on the mat';
        let picked = pool[Math.floor(Math.random() * pool.length)];
        while (pool.length > 1 && picked === currentText) {
            picked = pool[Math.floor(Math.random() * pool.length)];
        }
        return picked;
    }

    /* ---------- Game Setup ---------- */

    function startSession(level) {
        currentLevel = level;
        resultShown = false;
        currentText = pickText();

        TypingEngine.setDuration(0);
        TypingEngine.loadText(currentText);

        els.hiddenInput.value = '';
        UI.showSection(level);
        UI.renderText(currentText, 0);
        UI.updateStats({
            wpm: 0, accuracy: 100, elapsed: 0, errors: 0,
            progress: 0, charIndex: 0
        });
        UI.clearFeedback();
        UI.setFeedbackHint(LEVELS[level].hint);

        els.hiddenInput.focus();
        // Pre-unlock the "Fhaaa" error clip inside this real click gesture
        HarmoniumAudio.unlockErrorAudio();
        // Show the start of the paragraph instead of jumping down to the focus helper
        window.scrollTo(0, 0);
    }

    /* ---------- Keyboard Handling ---------- */

    const IGNORED_KEYS = [
        'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown', 'Escape',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9',
        'F10', 'F11', 'F12', 'Dead', 'ContextMenu', 'NumLock',
        'ScrollLock', 'PrintScreen', 'Insert', 'Delete', 'Enter'
    ];

    function handleKeyDown(e) {
        if (UI_typingHidden()) return;

        if (IGNORED_KEYS.includes(e.key)) return;

        const activeEl = document.activeElement;
        const isTypingContext =
            els.textDisplay === activeEl ||
            els.hiddenInput === activeEl;
        if (!isTypingContext) return;

        e.preventDefault();

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

        const title = '🎵 ' + (LEVELS[currentLevel].label) + ' · Complete!';
        UI.showResults(result, title);
    }

    /* ---------- Timer updates ---------- */

    function tick() {
        const state = TypingEngine.getState();
        if (state.running && !state.finished) {
            updateStatsUI();
        } else if (state.finished && !resultShown) {
            finishSession();
        }
    }

    /* ---------- Events ---------- */

    function bindEvents() {
        // Level cards start a session
        document.querySelectorAll('.level-card').forEach(card => {
            card.addEventListener('click', () => {
                startSession(card.dataset.level);
            });
        });

        // Back to levels
        document.getElementById('levelsBtn').addEventListener('click', () => {
            UI.showHero();
        });

        document.getElementById('logoBtn').addEventListener('click', () => {
            UI.showHero();
        });

        // Restart
        document.getElementById('restartBtn').addEventListener('click', () => {
            startSession(currentLevel);
        });

        // Results modal
        document.getElementById('tryAgainBtn').addEventListener('click', () => {
            UI.hideResults();
            startSession(currentLevel);
        });

        document.getElementById('newTextBtn').addEventListener('click', () => {
            UI.hideResults();
            currentText = '';
            startSession(currentLevel);
        });

        document.getElementById('changeLevelBtn').addEventListener('click', () => {
            UI.hideResults();
            UI.showHero();
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

        // Sound toggles
        const soundOnToggle = document.getElementById('soundOnToggle');
        soundOnToggle.addEventListener('change', () => {
            soundEnabled = soundOnToggle.checked;
            HarmoniumAudio.setSoundEnabled(soundEnabled);
            syncSoundIcon();
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
            els.hiddenInput.focus({ preventScroll: true });
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

    /* ---------- Init ---------- */

    async function init() {
        els = {
            textDisplay: document.getElementById('textDisplay'),
            hiddenInput: document.getElementById('hiddenInput'),
            typingSection: document.getElementById('typingSection'),
        };

        UI.init();
        HarmoniumAudio.setSoundEnabled(soundEnabled);

        await loadTexts();
        bindEvents();

        document.getElementById('soundOnToggle').checked = soundEnabled;
        syncSoundIcon();

        // Gentle ambient particles on the levels page
        setInterval(() => {
            if (document.getElementById('typingSection').classList.contains('hidden')) {
                const notes = ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'];
                UI.spawnNoteParticle(notes[Math.floor(Math.random() * notes.length)]);
            }
        }, 3000);

        // Deep link (e.g. from the 404 page): index.html?level=easy
        const deepLevel = new URLSearchParams(window.location.search).get('level');
        if (deepLevel && LEVELS[deepLevel]) {
            startSession(deepLevel);
        }
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);