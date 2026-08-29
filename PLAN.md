# Harmonium Typing - Implementation Plan

## Project Overview
A musical typing practice and test website where each keystroke plays a harmonium note, creating an interactive and enjoyable learning experience.

---

## Core Features

### 1. Typing Test Engine
- **WPM Calculation**: (Characters typed / 5) / Time in minutes
- **Accuracy**: (Correct characters / Total characters) × 100
- **Real-time Stats**: Live WPM, accuracy, and error count
- **Test Modes**: Timed (30s, 60s, 120s) and Word-count based

### 2. Harmonium Sound System (Web Audio API)
- **Oscillator-based synthesis** mimicking harmonium reed sounds
- **Key-to-Note Mapping** using Indian musical scale (Sargam):
  - Row 1 (Q-P): Lower octave (Sa, Re, Ga, Ma, Pa, Dha, Ni)
  - Row 2 (A-L): Middle octave
  - Row 3 (Z-M): Upper octave
- **Envelope shaping** for authentic harmonium attack/decay

### 3. Visual Feedback
- **Key highlight** on press with note name
- **Gradient background** that shifts based on notes played
- **Particle effects** on correct typing
- **Error shake animation** for wrong keys

---

## File Structure

```
KeyboardHarmonium/
├── index.html          # Main HTML structure
├── css/
│   └── style.css       # All styling with gradients
├── js/
│   ├── audio.js        # Harmonium sound synthesis
│   ├── typing.js       # Typing test logic
│   ├── ui.js           # UI interactions
│   └── app.js          # Main app initialization
└── assets/
    └── texts.json      # Sample texts for practice
```

---

## Technical Implementation

### HTML Structure (index.html)
1. **Header**: Logo, title, nav (Home, Practice, Test, Settings)
2. **Hero Section**: Animated harmonium visual
3. **Typing Area**:
   - Text display with current word highlighting
   - Input area (hidden textarea for mobile support)
   - Virtual keyboard visualization
4. **Stats Panel**: WPM, Accuracy, Time, Errors
5. **Results Modal**: Final score with grade
6. **Settings Panel**: Duration, difficulty, sound toggle

### CSS Styling (style.css)
1. **Color Scheme**:
   - Primary gradient: Purple → Pink → Orange (musical warmth)
   - Note-based accent colors (C=Red, D=Orange, E=Yellow, etc.)
   - Glass morphism for panels

2. **Animations**:
   - @keyframes for key press pulse
   - Gradient shift on background
   - Smooth transitions for all interactive elements

3. **Responsive Design**:
   - Mobile-friendly with virtual keyboard
   - Tablet optimized layout

### JavaScript Modules

#### audio.js - Sound Engine
```javascript
// Harmonium synthesis using Web Audio API
class HarmoniumAudio {
  constructor() {
    this.audioCtx = null;
    this.noteFrequencies = {
      // Indian Sargam notes
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63,
      'F4': 349.23, 'G4': 392.00, 'A4': 440.00,
      'B4': 493.88, 'C5': 523.25
    };
  }
  
  playNote(key) {
    // Create oscillator + gain node
    // Apply harmonium-like envelope
    // Map key to frequency
  }
}
```

#### typing.js - Test Engine
```javascript
class TypingTest {
  constructor() {
    this.text = '';
    this.startTime = null;
    this.errors = 0;
    this.totalKeystrokes = 0;
  }
  
  calculateWPM() { }
  calculateAccuracy() { }
  checkCharacter(input) { }
  endTest() { }
}
```

#### ui.js - Interface
```javascript
class UI {
  updateStats() { }
  highlightKey(note) { }
  updateGradient(note) { }
  showResults() { }
}
```

#### app.js - Main
```javascript
// Initialize all modules
// Event listeners for keyboard
// Timer management
// Settings handling
```

---

## Key-to-Note Mapping

```
Keyboard Layout → Musical Notes:
┌─────────────────────────────────────────┐
│  1  2  3  4  5  6  7  8  9  0  -  =   │  (Percussion)
│  Q  W  E  R  T  Y  U  I  O  P  [  ]    │  Lower Octave
│   A  S  D  F  G  H  J  K  L  ;  '      │  Middle Octave
│    Z  X  C  V  B  N  M  ,  .  /        │  Upper Octave
└─────────────────────────────────────────┘

Mapping:
Q=Sa(C4)  W=Re(D4)  E=Ga(E4)  R=Ma(F4)  T=Pa(G4)  Y=Dha(A4)  U=Ni(B4)
A=Sa(C5)  S=Re(D5)  D=Ga(E5)  F=Ma(F5)  G=Pa(G5)  H=Dha(A5)  J=Ni(B5)
Z=Sa(C6)  X=Re(D6)  C=Ga(E6)  V=Ma(F6)  B=Pa(G6)  N=Dha(A6)  M=Ni(B6)
```

---

## Color Gradient Mapping

Each note maps to a gradient color:
| Note | Color | Hex |
|------|-------|-----|
| Sa (C) | Deep Red | #FF4444 |
| Re (D) | Orange | #FF8C00 |
| Ga (E) | Golden Yellow | #FFD700 |
| Ma (F) | Green | #00C853 |
| Pa (G) | Sky Blue | #00BFFF |
| Dha (A) | Indigo | #4B0082 |
| Ni (B) | Violet | #9400D3 |

---

## Implementation Phases

### Phase 1: Core Setup (HTML + CSS + Basic JS)
1. Create index.html with semantic structure
2. Build CSS with gradients and animations
3. Implement basic keyboard event handling

### Phase 2: Audio Engine
1. Set up Web Audio API context
2. Create harmonium oscillator function
3. Map keys to frequencies
4. Add envelope shaping

### Phase 3: Typing Logic
1. Text display and cursor
2. Character validation
3. WPM and accuracy calculation
4. Timer functionality

### Phase 4: Visual Effects
1. Key press animations
2. Background gradient shifts
3. Results modal
4. Responsive adjustments

### Phase 5: Polish
1. Sound toggle option
2. Difficulty levels
3. Local storage for high scores
4. Mobile virtual keyboard

---

## Sample Texts (texts.json)
```json
{
  "easy": [
    "the cat sat on the mat",
    "hello world this is typing"
  ],
  "medium": [
    "the quick brown fox jumps over the lazy dog",
    "practice makes perfect when you type every day"
  ],
  "hard": [
    "complex sentences with punctuation, hyphens, and numbers 123!",
    "programming requires attention to detail and consistent practice"
  ]
}
```

---

## Dependencies (None - Pure Vanilla)
- HTML5
- CSS3 (with variables, grid, flexbox)
- JavaScript ES6+
- Web Audio API (browser native)

---

## Browser Support
- Chrome 66+
- Firefox 60+
- Safari 14.1+
- Edge 79+

---

## Future MERN Migration Plan
When moving to MERN:
- React for UI components
- Express for API
- MongoDB for user scores/history
- Node.js for backend audio generation (if needed)
- User authentication for saving progress

---

## Success Metrics
- [ ] Typing test accurately calculates WPM and accuracy
- [ ] Each key plays a distinct harmonium note
- [ ] Visual feedback is smooth and responsive
- [ ] UI is aesthetic with gradient effects
- [ ] Works on desktop and mobile
- [ ] No audio lag on keypress
- [ ] Scores are genuine and calculated correctly
