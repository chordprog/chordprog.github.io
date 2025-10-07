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

// --- Populate Dropdowns ---
const keySelect = document.getElementById('key-select');
const typeSelect = document.getElementById('type-select');

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

// --- Event Handler ---
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

// --- Functions ---
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

function noteToFrequency(note) {
  const noteIndex = NOTES.indexOf(note);
  if (noteIndex === -1) return null;
  return BASE_FREQ * Math.pow(2, noteIndex / 12);
}

function playChord(notes) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;

  notes.forEach(note => {
    const freq = noteToFrequency(note);
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
