/* ============================================
   UI Module - visuals, feedback, keyboard display
   ============================================ */

'use strict';

const UI = (() => {

    let noteColors = HarmoniumAudio.getColors();

    /* ---------- Elements ---------- */
    let els = {};

    // Sargam chart data: key, sargam, western, octave hint
    const CHART = [
        { key: 'A', sa: 'सा', west: 'Sa', octave: 'Middle octave' },
        { key: 'S', sa: 'रे', west: 'Re', octave: 'Middle octave' },
        { key: 'D', sa: 'गा', west: 'Ga', octave: 'Middle octave' },
        { key: 'F', sa: 'मा', west: 'Ma', octave: 'Middle octave' },
        { key: 'G', sa: 'पा', west: 'Pa', octave: 'Middle octave' },
        { key: 'H', sa: 'धा', west: 'Dha', octave: 'Middle octave' },
        { key: 'J', sa: 'नी', west: 'Ni', octave: 'Middle octave' },
        { key: 'K', sa: 'सा˙', west: 'Sa', octave: 'Higher' },
        { key: 'L', sa: 'रे˙', west: 'Re', octave: 'Higher' },
    ];

    function init() {
        els = {
            bgGradient: document.getElementById('bgGradient'),
            heroPractice: document.getElementById('heroPractice'),
            heroTest: document.getElementById('heroTest'),
            heroSection: document.getElementById('heroSection'),
            statsBar: document.getElementById('statsBar'),
            typingSection: document.getElementById('typingSection'),
            wpmDisplay: document.getElementById('wpmDisplay'),
            accuracyDisplay: document.getElementById('accuracyDisplay'),
            timerDisplay: document.getElementById('timerDisplay'),
            timeLabel: document.getElementById('timeLabel'),
            timeUnit: document.getElementById('timeUnit'),
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
        buildNoteChart();
    }

    function buildNoteChart() {
        const chartEl = document.getElementById('noteChart');
        if (!chartEl) return;
        chartEl.innerHTML = '';
        const order = ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'];
        CHART.forEach(item => {
            const card = document.createElement('div');
            card.className = 'note-card';
            const idx = CHART.indexOf(item) % 7;
            const note = order[idx];
            card.style.background = 'linear-gradient(145deg, ' + noteColors[note] + '33, transparent)';
            card.style.borderColor = noteColors[note];
            card.innerHTML = `
                <span class="nc-key">${item.key}</span>
                <span class="nc-sa">${item.sa}</span>
                <span class="nc-west">${item.west}</span>
                <span class="nc-oct">${item.octave}</span>
            `;
            card.addEventListener('click', () => {
                HarmoniumAudio.playDemoNote(note);
                card.style.boxShadow = '0 0 30px ' + noteColors[note];
                setTimeout(() => { card.style.boxShadow = ''; }, 300);
            });
            chartEl.appendChild(card);
        });
    }

    /* ---------- Section Management ---------- */

    function showHero(mode) {
        els.statsBar.classList.add('hidden');
        els.typingSection.classList.add('hidden');
        if (mode === 'test') {
            els.heroPractice.classList.add('hidden');
            els.heroTest.classList.remove('hidden');
        } else {
            els.heroTest.classList.add('hidden');
            els.heroPractice.classList.remove('hidden');
        }
    }

    function showSection(section) {
        els.heroPractice.classList.add('hidden');
        els.heroTest.classList.add('hidden');
        els.statsBar.classList.remove('hidden');
        els.typingSection.classList.remove('hidden');
        if (section === 'practice') {
            els.difficultyLabel.textContent = 'Practice Mode · No Timer';
            els.difficultyLabel.style.background =
                'linear-gradient(135deg, rgba(38, 222, 129, 0.2), rgba(32, 191, 230, 0.2))';
            els.difficultyLabel.style.color = '#6ef2a1';
            els.difficultyLabel.style.borderColor = 'rgba(38, 222, 129, 0.3)';
            els.feedbackHint.textContent =
                'No timer · type at your own pace · listen to each swara';
            els.timeLabel.textContent = 'Elapsed';
            els.timeUnit.textContent = 's';
        } else {
            els.difficultyLabel.textContent = 'Test Mode · Timed';
            els.difficultyLabel.style.background =
                'linear-gradient(135deg, rgba(255, 211, 42, 0.2), rgba(255, 140, 66, 0.2))';
            els.difficultyLabel.style.color = '#ffd86b';
            els.difficultyLabel.style.borderColor = 'rgba(255, 211, 42, 0.3)';
            els.feedbackHint.textContent =
                'Type as fast and as accurately as you can — the clock is running!';
            els.timeLabel.textContent = 'Time Left';
            els.timeUnit.textContent = 's';
        }
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
        els.timerDisplay.textContent = data.time !== undefined
            ? Math.ceil(data.time)
            : Math.floor(data.elapsed);
        els.errorDisplay.textContent = data.errors;
        els.progressDisplay.textContent = data.progress;

        // Urgent color when time is running low in test mode
        if (data.time !== undefined && data.time <= 5 && data.time > 0) {
            els.timerDisplay.style.color = '#ff4757';
            els.timerDisplay.style.animation = 'charPulse 0.6s ease-in-out infinite';
        } else {
            els.timerDisplay.style.color = '';
            els.timerDisplay.style.animation = '';
        }

        // Update typing counts info
        const totalText = TypingEngine.text ? TypingEngine.text.length : 0;
        els.typingCounts.textContent =
            `Pos ${Math.min(data.charIndex, totalText)}/${totalText} chars`;
    }

    /* ---------- Countdown Overlay ---------- */

    let countdownEls = null;
    function showCountdown(number, beatNote) {
        if (!countdownEls) {
            countdownEls = {
                overlay: document.getElementById('countdownOverlay'),
                num: document.getElementById('countdownNumber'),
            };
        }
        countdownEls.overlay.classList.remove('hidden');
        countdownEls.num.textContent = number;
        countdownEls.num.style.animation = 'none';
        void countdownEls.num.offsetWidth;
        countdownEls.num.style.animation = 'countPop 0.9s ease';
        countdownEls.overlay.style.borderColor = beatNote;
        countdownEls.overlay.style.setProperty('--ring', beatNote);
    }

    function hideCountdown() {
        if (countdownEls) countdownEls.overlay.classList.add('hidden');
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
        if (titleEl) titleEl.textContent = title || '🎉 Test Complete!';
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
        shiftBackground,
        spawnNoteParticle,
        showCountdown,
        hideCountdown,
        showResults,
        hideResults,
        showSettings,
        hideSettings,
        setupHarmoniumVisual,
    };

})();