// --- Core Data ---
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F',
               'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_FREQ = 261.63; // C4 base frequency (Equal Temperament base)
const BASE_FREQ_JUST = 264; // Approx base for Just Intonation root C4

// Chord formulas
const CHORD_TYPES = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented': [0, 4, 8],
  'Major 7th': [0, 4, 7, 11],
  'Minor 7th': [0, 3, 7, 10],
  'Dominant 7th': [0, 4, 7, 10],
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7]
};

// --- Populate Dropdowns ---
const keySelect = document.getElementById('key-select');
const typeSelect = document.getElementById('type-select');
const tuningSwitch = document.getElementById('tuning-switch');

NOTES.forEach(note => {
  const opt = document.createElement('option');
  opt.value = note;
  opt.textContent = note;
  keySelect.appendChild(opt);
});

Object.keys(CHORD_TYPES).forEach(type => {
  const opt = document.createElement('option');
  opt.value = type;
  opt.textContent = type;
  typeSelect.appendChild(opt);
});

// --- Create Note Circle ---
const circle = document.getElementById('note-circle');
const radius = 130;

NOTES.forEach((note, i) => {
  const angle = (i / NOTES.length) * 2 * Math.PI - Math.PI / 2;
  const x = 160 + radius * Math.cos(angle) - 25;
  const y = 160 + radius * Math.sin(angle) - 25;

  const div = document.createElement('div');
  div.className = 'note';

  const nameEl = document.createElement('div');
  nameEl.textContent = note;
  nameEl.classList.add('note-name');

  const freqEl = document.createElement('div');
  freqEl.classList.add('note-freq');
  freqEl.textContent = '';

  div.appendChild(nameEl);
  div.appendChild(freqEl);
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  circle.appendChild(div);
});

document.querySelectorAll('.note').forEach(div => {
  div.style.textAlign = 'center';
  div.style.lineHeight = '1em';
});

updateFrequenciesDisplay();

// --- Shared Audio Context ---
let audioCtx;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

window.addEventListener('click', () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
});

// --- Tuning Handling ---
tuningSwitch.addEventListener('change', updateFrequenciesDisplay);

// --- Event Listeners ---
[keySelect, typeSelect].forEach(sel => {
  sel.addEventListener('change', () => {
    const root = keySelect.value;
    const type = typeSelect.value;
    if (!root || !type) return;

    const chordNotes = getChordNotes(root, type);
    updateCircle(chordNotes);
    playChord(chordNotes);
  });
});

document.getElementById('play-btn').addEventListener('click', () => {
  const root = keySelect.value;
  const type = typeSelect.value;
  if (!root || !type) return;
  const chordNotes = getChordNotes(root, type);
  playChord(chordNotes);
});

// --- Functions ---
function getChordNotes(root, type) {
  const intervals = CHORD_TYPES[type];
  if (!intervals) return [];
  const rootIndex = NOTES.indexOf(root);
  return intervals.map(i => NOTES[(rootIndex + i) % 12]);
}

function updateCircle(activeNotes) {
  document.querySelectorAll('.note').forEach(el => {
    el.classList.toggle('active', activeNotes.includes(el.querySelector('.note-name').textContent));
  });
}

function updateFrequenciesDisplay() {
  const useEqual = tuningSwitch.checked;
  document.querySelectorAll('.note').forEach(div => {
    const note = div.querySelector('.note-name').textContent;
    const freq = noteToFrequency(note, useEqual);
    div.querySelector('.note-freq').textContent = `${freq.toFixed(1)} Hz`;
  });
}

function noteToFrequency(note, equalTemperament = true) {
  const noteIndex = NOTES.indexOf(note);
  if (noteIndex === -1) return null;

  if (equalTemperament) {
    return BASE_FREQ * Math.pow(2, noteIndex / 12);
  } else {
    // Just Intonation ratios relative to C
    const ratios = [1, 16/15, 9/8, 6/5, 5/4, 4/3, 
                    45/32, 3/2, 8/5, 5/3, 9/5, 15/8];
    return BASE_FREQ_JUST * ratios[noteIndex];
  }
}

function playChord(notes) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  const now = ctx.currentTime;
  const useEqual = tuningSwitch.checked;

  notes.forEach(note => {
    const freq = noteToFrequency(note, useEqual);
    if (!freq) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.5);
  });
}
