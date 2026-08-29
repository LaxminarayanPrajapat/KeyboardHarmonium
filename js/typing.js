/* ============================================
   Typing Test Engine
   Tracks performance with genuine scoring
   ============================================ */

'use strict';

const TypingEngine = (() => {

    let text = '';
    let positions = [];          // per-position correctness (true/false)
    let startTime = null;
    let endTime = null;
    let timerId = null;
    let duration = 60;           // seconds (0 = untimed/practice)
    let running = false;
    let finished = false;

    // Stats
    let correctChars = 0;
    let wrongCount = 0;
    let keyStrokes = 0;
    let timerDisplay = 0;

    const charsPerWord = 5;      // standard: 1 word = 5 characters

    /* ---------- Setup ---------- */

    function loadText(newText) {
        text = newText;
        positions = [];
        correctChars = 0;
        wrongCount = 0;
        keyStrokes = 0;
        timerDisplay = 0;
        startTime = null;
        endTime = null;
        running = false;
        finished = false;
        stopTimer();
    }

    function setDuration(seconds) {
        duration = seconds;
    }

    /* ---------- Timer ---------- */

    function startTimer() {
        if (timerId || startTime) return;
        startTime = performance.now();
        timerId = setInterval(() => {
            timerDisplay = getElapsed();
            if (duration > 0 && timerDisplay >= duration && !finished) {
                finish();
            }
        }, 100);
    }

    function getElapsed() {
        if (!startTime) return 0;
        const e = endTime || performance.now();
        return (e - startTime) / 1000;
    }

    function stopTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    /* ---------- Input Handling ---------- */

    // Returns { result: 'correct' | 'wrong', char } or null if finished
    function handleChar(char) {
        if (finished) return null;

        if (!running && /^[\s\S]$/.test(char)) {
            running = true;
            startTimer();
        }

        keyStrokes++;

        if (charIndex() >= text.length) {
            // No more characters left but not yet finished
            if (!finished) {
                running = false;
            }
            return null;
        }

        const expected = text[charIndex()];

        if (char.length === 1 && char === expected) {
            positions.push(true);
            correctChars++;
            return { result: 'correct', char };
        } else {
            positions.push(false);
            wrongCount++;
            return { result: 'wrong', typed: char, expected };
        }
    }

    // Backspace: remove last position, adjusting counters
    function handleBackspace() {
        if (finished || charIndex() === 0) return { result: 'noop' };

        const last = positions.pop();
        if (last === true) {
            correctChars = Math.max(0, correctChars - 1);
        } else {
            wrongCount = Math.max(0, wrongCount - 1);
        }
        keyStrokes++;
        return { result: 'backspace' };
    }

    /* ---------- Metrics ---------- */

    function charIndex() {
        return positions.length;
    }

    function getWpm() {
        const minutes = getElapsed() / 60;
        if (minutes <= 0) return 0;
        return Math.max(0, Math.round((correctChars / charsPerWord) / minutes));
    }

    function getGrossWpm() {
        const minutes = getElapsed() / 60;
        if (minutes <= 0) return 0;
        const grossChars = correctChars + wrongCount;
        return Math.max(0, Math.round((grossChars / charsPerWord) / minutes));
    }

    function getAccuracy() {
        const total = correctChars + wrongCount;
        if (total === 0) return 100;
        return Math.round((correctChars / total) * 100);
    }

    function getScore() {
        const wpm = getWpm();
        const acc = getAccuracy();
        // Genuine combined score rewarding both speed and accuracy
        return Math.max(0, Math.round(wpm * (acc * acc) / 10000 * 2));
    }

    function getGrade() {
        const wpm = getWpm();
        const acc = getAccuracy();
        if (wpm >= 80 && acc >= 97) return { grade: 'S', label: 'Maestro' };
        if (wpm >= 65 && acc >= 95) return { grade: 'A', label: 'Pro' };
        if (wpm >= 50 && acc >= 92) return { grade: 'B', label: 'Good' };
        if (wpm >= 35 && acc >= 88) return { grade: 'C', label: 'Learner' };
        return { grade: 'D', label: 'Beginner' };
    }

    function getProgress() {
        if (!text.length) return 0;
        return Math.round((charIndex() / text.length) * 100);
    }

    function isComplete() {
        return charIndex() >= text.length;
    }

    /* ---------- Finish ---------- */

    function finish() {
        if (!finished) {
            finished = true;
            endTime = performance.now();
            stopTimer();
            running = false;
        }

        return {
            wpm: getWpm(),
            grossWpm: getGrossWpm(),
            accuracy: getAccuracy(),
            score: getScore(),
            gradeObj: getGrade(),
            errors: wrongCount,
            elapsed: getElapsed(),
            progress: getProgress(),
            complete: isComplete(),
            durationLimit: duration,
        };
    }

    /* ---------- Getters ---------- */

    function getState() {
        return {
            charIndex: charIndex(),
            correctChars,
            wrongCount,
            keyStrokes,
            elapsed: Math.floor(timerDisplay),
            running,
            finished,
        };
    }

    function isPositionCorrect(i) {
        return positions[i] === true;
    }

    return {
        loadText,
        setDuration,
        handleChar,
        handleBackspace,
        getWpm,
        getGrossWpm,
        getAccuracy,
        getScore,
        getGrade,
        getProgress,
        getState,
        isPositionCorrect,
        finish,
        isComplete,
        get currentIndex() { return charIndex(); },
        get text() { return text; },
        get running() { return running; },
        get finished() { return finished; },
    };

})();