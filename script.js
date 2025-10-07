// --- Core Data ---
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 
               'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_FREQ = 261.63; // C4 base frequency

// Chord formula intervals (in semitones)
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

// --- DOM Elements ---
const keySelect = document.getElementById('key-select');
const typeSelect = document.getElementById('type-select');
const playBtn = document.getElementById('play-btn');

// --- Populate Dropdowns ---
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
  const x = 160 + radius * Math.cos(angle) - 20;
  const y = 160 + radius * Math.sin(angle) - 20;

  const div = document.createElement('div');
  div.className = 'note';
  div.textContent = note;
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  circle.appendChild(div);
});

// --- Shared AudioContext ---
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

// --- Helpers ---
function getChordNotes(root, type) {
  const intervals = CHORD_TYPES[type];
  if (!intervals) return [];
  const rootIndex = NOTES.indexOf(root);
  return intervals.map(i => NOTES[(rootIndex + i) % 12]);
}

function updateCircle(activeNotes) {
  document.querySelectorAll('.note').forEach(el => {
    el.classList.toggle('active', activeNotes.includes(el.textContent));
  });
}

// --- New: Tuning mode toggle ---
const tuningMode = document.getElementById('tuning-mode');
const tuningLabel = document.getElementById('tuning-label');

// --- Just Intonation Ratios (relative to root) ---
const JUST_RATIOS = {
  'Major':       [1, 5/4, 3/2],
  'Minor':       [1, 6/5, 3/2],
  'Diminished':  [1, 6/5, 7/5],
  'Augmented':   [1, 5/4, 25/16],
  'Major 7th':   [1, 5/4, 3/2, 15/8],
  'Minor 7th':   [1, 6/5, 3/2, 9/5],
  'Dominant 7th':[1, 5/4, 3/2, 7/4],
  'Sus2':        [1, 9/8, 3/2],
  'Sus4':        [1, 4/3, 3/2]
};

// Update label text dynamically
tuningMode.addEventListener('change', () => {
  tuningLabel.textContent = tuningMode.checked 
    ? 'Just Intonation' 
    : 'Equal Temperament';
});

// --- Modified noteToFrequency ---
function noteToFrequency(note, rootNote, chordType, noteIndex) {
  const rootFreq = BASE_FREQ * Math.pow(2, NOTES.indexOf(rootNote) / 12);

  if (tuningMode.checked && JUST_RATIOS[chordType]) {
    // Use just intonation ratios if available
    const ratio = JUST_RATIOS[chordType][noteIndex] || 1;
    return rootFreq * ratio;
  } else {
    // Default: Equal temperament
    const semitoneDiff = (NOTES.indexOf(note) - NOTES.indexOf(rootNote) + 12) % 12;
    return rootFreq * Math.pow(2, semitoneDiff / 12);
  }
}

// --- Modified playChord ---
function playChord(notes, root, type) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  const now = ctx.currentTime;

  notes.forEach((note, i) => {
    const freq = noteToFrequency(note, root, type, i);
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

// --- Update play calls ---
[keySelect, typeSelect].forEach(sel => {
  sel.addEventListener('change', () => {
    const root = keySelect.value;
    const type = typeSelect.value;
    if (!root || !type) return;

    const chordNotes = getChordNotes(root, type);
    updateCircle(chordNotes);
    playChord(chordNotes, root, type);
  });
});

playBtn.addEventListener('click', () => {
  const root = keySelect.value;
  const type = typeSelect.value;
  if (!root || !type) return;

  const chordNotes = getChordNotes(root, type);
  playChord(chordNotes, root, type);
});

