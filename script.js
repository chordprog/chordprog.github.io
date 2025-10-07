const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 
                'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Simple chord definitions (you can expand these later)
const chords = {
  Cmaj: ['C', 'E', 'G'],
  Gmaj: ['G', 'B', 'D'],
  Amin: ['A', 'C', 'E'],
  Fmaj7: ['F', 'A', 'C', 'E'],
  D7: ['D', 'F#', 'A', 'C']
};

// Create the note circle
const circle = document.getElementById('note-circle');
const radius = 120;
notes.forEach((note, i) => {
  const angle = (i / notes.length) * 2 * Math.PI;
  const x = 150 + radius * Math.cos(angle) - 20;
  const y = 150 + radius * Math.sin(angle) - 20;
  
  const div = document.createElement('div');
  div.className = 'note';
  div.textContent = note;
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  circle.appendChild(div);
});

const chordSelect = document.getElementById('chord-select');
chordSelect.addEventListener('change', () => {
  const selected = chordSelect.value;
  const chordNotes = chords[selected] || [];
  
  document.querySelectorAll('.note').forEach(el => {
    if (chordNotes.includes(el.textContent)) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
});
