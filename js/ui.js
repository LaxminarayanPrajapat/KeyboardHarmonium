/* ============================================
   UI Module - visuals, feedback, animations
   ============================================ */

'use strict';

const UI = (() => {

    let noteColors = HarmoniumAudio.getColors();

    // Level label + badge colors
    const LEVEL_STYLES = {
        easy: { label: 'Easy Peasy', color: '#6ef2a1', bg: 'rgba(38, 222, 129, 0.2)', border: 'rgba(38, 222, 129, 0.3)' },
        mid:  { label: 'Middle Ground', color: '#8dd8ff', bg: 'rgba(32, 191, 230, 0.2)', border: 'rgba(32, 191, 230, 0.3)' },
        beast:{ label: 'Beast', color: '#ff8a8a', bg: 'rgba(255, 71, 87, 0.2)', border: 'rgba(255, 71, 87, 0.3)' },
        nums: { label: 'Numbers', color: '#ffd86b', bg: 'rgba(255, 211, 42, 0.2)', border: 'rgba(255, 211, 42, 0.3)' },
    };

    /* ---------- Elements ---------- */
    let els = {};

    function init() {
        els = {
            bgGradient: document.getElementById('bgGradient'),
            heroLevels: document.getElementById('heroLevels'),
            statsBar: document.getElementById('statsBar'),
            typingSection: document.getElementById('typingSection'),
            wpmDisplay: document.getElementById('wpmDisplay'),
            accuracyDisplay: document.getElementById('accuracyDisplay'),
            timerDisplay: document.getElementById('timerDisplay'),
            errorDisplay: document.getElementById('errorDisplay'),
            progressDisplay: document.getElementById('progressDisplay'),
            textDisplay: document.getElementById('textDisplay'),
            textContent: document.getElementById('textContent'),
            textCursor: document.getElementById('textCursor'),
            hiddenInput: document.getElementById('hiddenInput'),
            feedbackHint: document.getElementById('feedbackHint'),
            feedbackNote: document.getElementById('feedbackNote'),
            difficultyLabel: document.getElementById('difficultyLabel'),
            typingCounts: document.getElementById('typingCounts'),
            noteFlow: document.getElementById('noteFlow'),
            resultsModal: document.getElementById('resultsModal'),
            resultScore: document.getElementById('resultScore'),
            resultGrade: document.getElementById('resultGrade'),
            resultWpm: document.getElementById('resultWpm'),
            resultAccuracy: document.getElementById('resultAccuracy'),
            resultErrors: document.getElementById('resultErrors'),
            resultTime: document.getElementById('resultTime'),
        };
    }

    /* ---------- Section Management ---------- */

    function showHero() {
        els.heroLevels.classList.remove('hidden');
        els.statsBar.classList.add('hidden');
        els.typingSection.classList.add('hidden');
    }

    function showSection(level) {
        els.heroLevels.classList.add('hidden');
        els.statsBar.classList.remove('hidden');
        els.typingSection.classList.remove('hidden');

        const style = LEVEL_STYLES[level] || LEVEL_STYLES.easy;
        els.difficultyLabel.textContent = style.label;
        els.difficultyLabel.style.background =
            'linear-gradient(135deg, ' + style.bg + ', rgba(255,255,255,0.06))';
        els.difficultyLabel.style.color = style.color;
        els.difficultyLabel.style.borderColor = style.border;
    }

    function setFeedbackHint(text) {
        els.feedbackHint.textContent = text || 'Start typing to begin...';
    }

    /* ---------- Text Rendering ---------- */

    // Render text; engine provides per-position correctness
    function renderText(text, currentIndex, engine) {
        els.textContent.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i];
            if (i < currentIndex) {
                const ok = engine ? engine.isPositionCorrect(i) : true;
                span.className = ok ? 'char-correct' : 'char-wrong';
            } else if (i === currentIndex) {
                span.className = 'char-current';
            }
            fragment.appendChild(span);
        }

        els.textContent.appendChild(fragment);
    }

    /* ---------- Stats ---------- */

    function updateStats(data) {
        els.wpmDisplay.textContent = data.wpm;
        els.accuracyDisplay.textContent = data.accuracy;
        els.timerDisplay.textContent = Math.floor(data.elapsed);
        els.errorDisplay.textContent = data.errors;
        els.progressDisplay.textContent = data.progress;

        // Update typing counts info
        const totalText = TypingEngine.text ? TypingEngine.text.length : 0;
        els.typingCounts.textContent =
            `Pos ${Math.min(data.charIndex, totalText)}/${totalText} chars`;
    }

    /* ---------- Feedback (note name) ---------- */

    function showNoteFeedback(chars) {
        if (!chars) return;
        els.feedbackNote.classList.add('show');
        els.feedbackNote.textContent = chars;
        clearTimeout(UI._noteTimer);
        UI._noteTimer = setTimeout(() => {
            els.feedbackNote.classList.remove('show');
        }, 300);
    }

    function clearFeedback() {
        els.feedbackNote.classList.remove('show');
    }

    /* ---------- Shake on error ---------- */

    function shakeDisplay() {
        els.textDisplay.classList.remove('shake');
        // force reflow for animation restart
        void els.textDisplay.offsetWidth;
        els.textDisplay.classList.add('shake');
        setTimeout(() => els.textDisplay.classList.remove('shake'), 350);
    }

    /* ---------- Background Gradient Shift ---------- */

    let bgTimer = null;
    function shiftBackground(noteName) {
        if (!noteName || !noteColors[noteName]) return;
        const color = noteColors[noteName];
        els.bgGradient.style.background =
            `linear-gradient(135deg, #1a0b2e 0%, #${hexToRgb(color, 0.4)} 40%, #0d0418 100%)`;
        clearTimeout(bgTimer);
        bgTimer = setTimeout(() => {
            els.bgGradient.style.background = '';
        }, 600);
    }

    function hexToRgb(hex, alpha) {
        const clean = hex.replace('#', '');
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }

    /* ---------- Note Flow Particles ---------- */

    function spawnNoteParticle(noteName) {
        if (!noteName || !noteColors[noteName]) return;
        const flow = els.noteFlow;
        if (!flow) return;

        const particle = document.createElement('span');
        const symbols = ['♩', '♪', '♫', '♬', '♭', '♮'];
        particle.className = 'flowing-note';
        particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        particle.style.left = (10 + Math.random() * 80) + '%';
        particle.style.bottom = '0%';
        particle.style.color = noteColors[noteName];
        flow.appendChild(particle);

        setTimeout(() => {
            if (particle.parentNode) particle.parentNode.removeChild(particle);
        }, 1300);
    }

    /* ---------- Results ---------- */

    function showResults(result, title) {
        const titleEl = document.getElementById('resultTitle');
        if (titleEl) titleEl.textContent = title || '🎵 Practice Complete!';
        els.resultScore.textContent = result.score;
        const gradeObj = result.gradeObj;

        els.resultGrade.textContent = gradeObj.label + ' · ' + gradeObj.grade;
        els.resultGrade.className = 'result-grade grade-' + gradeObj.grade.toLowerCase();
        if (gradeObj.grade === 'S') els.resultGrade.className = 'result-grade grade-s';

        els.resultWpm.textContent = result.wpm;
        els.resultAccuracy.textContent = result.accuracy + '%';
        els.resultErrors.textContent = result.errors;
        els.resultTime.textContent = Math.floor(result.elapsed) + 's';

        els.resultsModal.classList.remove('hidden');
    }

    function hideResults() {
        els.resultsModal.classList.add('hidden');
    }

    function showSettings() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    function hideSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    /* ---------- Harmonium Visual interaction ---------- */

    function setupHarmoniumVisual() {
        const keys = document.querySelectorAll('.harmonium-visual .h-key');
        keys.forEach(key => {
            key.addEventListener('click', () => {
                const noteName = key.dataset.key.replace('Note', '').toLowerCase();
                key.style.setProperty('--highlight', noteColors[noteName]);
                key.classList.remove('pressed');
                void key.offsetWidth;
                key.classList.add('pressed');
                setTimeout(() => key.classList.remove('pressed'), 200);
                HarmoniumAudio.playDemoNote(noteName);
            });
        });
    }

    return {
        init,
        showSection,
        showHero,
        renderText,
        updateStats,
        indicateError: shakeDisplay,
        showNoteFeedback,
        clearFeedback,
        setFeedbackHint,
        shiftBackground,
        spawnNoteParticle,
        showResults,
        hideResults,
        showSettings,
        hideSettings,
        setupHarmoniumVisual,
    };

})();