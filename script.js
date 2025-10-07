// Define the 12 chromatic notes
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 
               'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Simple chord definitions
const CHORDS = {
  Cmaj: ['C', 'E', 'G'],
  Gmaj: ['G', 'B', 'D'],
  Amin: ['A', 'C', 'E'],
  Fmaj7: ['F', 'A', 'C', 'E'],
  D7: ['D', 'F#', 'A', 'C']
};

// Base frequency for C4
const BASE_FREQ = 261.63;

// Create the note circle
const circle = document.getElementById('note-circle');
const radius = 120;

NOTES.forEach((note, i) => {
  const angle = (i / NOTES.length) * 2 * Math.PI;
  const x = 150 + radius * Math.cos(angle) - 20;
  const y = 150 + radius * Math.sin(angle) - 20;
  
  const div = document.createElement('div');
  div.className = 'note';
  div.textContent = note;
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  circle.appendChild(div);
});

// Setup dropdown behavior
const chordSelect = document.getElementById('chord-select');
chordSelect.addEventListener('change', async () => {
  const selected = chordSelect.value;
  const chordNotes = CHORDS[selected] || [];

  // Highlight notes on the circle
  document.querySelectorAll('.note').forEach(el => {
    if (chordNotes.includes(el.textContent)) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Play the chord
  if (chordNotes.length) {
    playChord(chordNotes);
  }
});


// --- AUDIO SECTION ---
function noteToFrequency(note) {
  // Get semitone distance from C4
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

    osc.type = 'sine'; // can also try 'triangle', 'square', or 'sawtooth'
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.5);
  });
}
