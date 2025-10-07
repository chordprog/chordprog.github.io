document.addEventListener('DOMContentLoaded', () => {
// ---------- CONFIG & DATA ----------
const DIVISIONS = [12, 19, 24, 31];
const DEFAULT_DIVISION = 12;
const BASE_FREQ_C4 = 261.63; // reference frequency for C (step 0)
const NOTE_RADIUS = 280;

// Standard 12-EDO semitone names (used as base)
const SEMITONE_NAMES_12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// 12-EDO chord formulas in semitone intervals (used as base, then mapped to other EDOs)
const CHORD_TYPES_12 = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented': [0, 4, 8],
  'Major 7th': [0, 4, 7, 11],
  'Minor 7th': [0, 3, 7, 10],
  'Dominant 7th': [0, 4, 7, 10],
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7],
};

// Additional microtonal chords (31-EDO examples)
const EXTRA_CHORDS_31 = {
  'Supermajor': [0, 9, 13],  // approximate steps in 31-EDO
  'Subminor': [0, 6, 13],
};

// Standard Just Intonation ratios for 12-EDO scale degrees (reference)
// index 0..11 -> semitone positions C, C#, D, ...
const STANDARD_JI_RATIOS_12 = [
  1/1,
  16/15,
  9/8,
  6/5,
  5/4,
  4/3,
  45/32,
  3/2,
  8/5,
  5/3,
  9/5,
  15/8
];

// Chord-specific JI ratios for chord playback (relative to root = 1)
// Provide the core chord JI ratios where appropriate.
// For chord types that aren't defined here, we fall back to approximations.
const CHORD_JI_RATIOS = {
  'Major':       [1, 5/4, 3/2],
  'Minor':       [1, 6/5, 3/2],
  'Diminished':  [1, 6/5, 7/5],
  'Augmented':   [1, 5/4, 25/16],
  'Major 7th':   [1, 5/4, 3/2, 15/8],
  'Minor 7th':   [1, 6/5, 3/2, 9/5],
  'Dominant 7th':[1, 5/4, 3/2, 7/4],
  'Sus2':        [1, 9/8, 3/2],
  'Sus4':        [1, 4/3, 3/2],
  'Supermajor':  [1, 9/8, 13/8], // example ratios for demonstration
  'Subminor':    [1, 6/5, 13/8]  // example ratios for demonstration
};

// ---------- DOM ELEMENTS ----------
const divisionSelect = document.getElementById('division-select');
const keySelect = document.getElementById('key-select');
const typeSelect = document.getElementById('type-select');
const tuningSwitch = document.getElementById('tuning-switch'); // unchecked = ET (left), checked = JI (right)
const playBtn = document.getElementById('play-btn');
const circleContainer = document.getElementById('note-circle');

// ---------- STATE ----------
let currentDivision = DEFAULT_DIVISION;
let noteNames = [];        // names for current division, length = currentDivision
let etFrequencies = [];    // equal temperament frequencies for full circle
let jiApproxFrequencies = []; // JI-approx frequencies per step for display
let chordSets = {};        // chord->intervals mapping for current division

// ---------- AUDIO ----------
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
// resume on user gesture
window.addEventListener('click', () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
});

// ---------- UTIL: microtonal note naming ----------
/*
  For step s in division N, compute semitonePos = s * (12 / N).
  baseSemitone = floor(semitonePos) -> index into SEMITONE_NAMES_12
  frac = semitonePos - baseSemitone (fractional semitone)
  Normalize frac into range [-0.5, 0.5) for labeling decision.
  Map fractional values to labels:
    near 0 -> natural (C)
    near ±0.5 -> half-sharp / half-flat
    near ±0.75 -> three-quarter-sharp / three-quarter-flat
    near ±0.25 -> quarter-sharp / quarter-flat (included if happens)
*/
function generateNoteNamesForDivision(N) {
  const names = [];
  for (let s = 0; s < N; s++) {
    const semitonePos = s * (12 / N);
    const base = Math.floor(semitonePos);
    const semitoneIndex = ((base % 12) + 12) % 12;
    let frac = semitonePos - base; // 0..<1
    // normalize to -0.5..+0.5
    if (frac >= 0.5) frac = frac - 1;
    const absFrac = Math.abs(frac);

    // thresholds (in semitones) for labeling
    const T_QUARTER = 0.25;   // quarter-tone-ish
    const T_HALF = 0.5 - 0.125; // center region for half (we treat ~0.5)
    // We'll compare to multiples: quarter=0.25, half=0.5, three-quarter=0.75 (via rounding)
    // Convert frac to quarter steps (0.25)
    const q = Math.round(frac * 4) / 4; // quarter increments

    // choose label
    let label = '';
    if (Math.abs(q) < 0.125) {
      // near 0: natural
      label = SEMITONE_NAMES_12[semitoneIndex];
    } else {
      // Sign and magnitude
      const sign = q > 0 ? 'sharp' : 'flat';
      const mag = Math.abs(q); // in quarters
      if (Math.abs(mag - 1/2) < 0.001 || Math.abs(mag - 2/4) < 0.001) { // 0.5 semitone
        label = `${SEMITONE_NAMES_12[semitoneIndex]} half-${sign}`;
      } else if (Math.abs(mag - 3/4) < 0.001) {
        label = `${SEMITONE_NAMES_12[semitoneIndex]} three-quarter-${sign}`;
      } else if (Math.abs(mag - 1/4) < 0.001) {
        // quarter: name it "quarter-sharp/flat"
        label = `${SEMITONE_NAMES_12[semitoneIndex]} quarter-${sign}`;
      } else {
        // fallback: show decimal cents offset
        const cents = frac * 100;
        label = `${SEMITONE_NAMES_12[semitoneIndex]} (${cents.toFixed(1)}c)`;
      }
    }
    names.push(label);
  }
  return names;
}

// ---------- UTIL: frequency calculations ----------

// Equal temperament frequency for step index s in currentDivision:
// f = BASE_FREQ_C4 * 2^(s / division)
function computeETFrequencies(N) {
  const arr = [];
  for (let s = 0; s < N; s++) {
    arr.push(BASE_FREQ_C4 * Math.pow(2, s / N));
  }
  return arr;
}

// Build a JI-approx scale for display for division N.
// Strategy: map each step's semitone position s*(12/N) to nearest 12-EDO semitone index,
// then use the STANDARD_JI_RATIOS_12 for that semitone, adjusting by octaves if needed.
// This produces a JI-flavored frequency assigned to each microtonal step for display purposes.
function computeJIApproxFrequencies(N) {
  const arr = [];
  for (let s = 0; s < N; s++) {
    const semitonePos = s * (12 / N);
    const semitoneIndexRound = Math.round(semitonePos);
    const octaveOffset = Math.floor(semitonePos / 12);
    const jiRatio = STANDARD_JI_RATIOS_12[((semitoneIndexRound % 12) + 12) % 12];
    const freq = BASE_FREQ_C4 * jiRatio * Math.pow(2, octaveOffset);
    arr.push(freq);
  }
  return arr;
}

// For chord playback in JI mode we prefer chord-specific ratios (CHORD_JI_RATIOS).
// We'll compute rootFreq from ET root step and multiply by each ratio for playback.
// rootStep is the step index of root in the current division.
function computeJIFrequenciesForChord(rootStep, chordType, numNotes) {
  const rootFreqET = etFrequencies[rootStep]; // anchor root frequency (ET reference)
  const ratios = CHORD_JI_RATIOS[chordType];
  if (ratios && ratios.length >= numNotes) {
    // use the provided ratios for that chord type
    return ratios.slice(0, numNotes).map(r => rootFreqET * r);
  } else if (ratios && ratios.length < numNotes) {
    // provided ratios shorter than numNotes -> reuse last ratio for extras (not ideal)
    const out = [];
    for (let i = 0; i < numNotes; i++) {
      const r = ratios[Math.min(i, ratios.length - 1)];
      out.push(rootFreqET * r);
    }
    return out;
  } else {
    // fallback approach:
    // Map chord type to approximate semitone steps (via CHORD_TYPES_12), then derive JI ratio per step:
    const semitoneIntervals = CHORD_TYPES_12[chordType];
    if (!semitoneIntervals) {
      // fallback: evenly spaced within an octave
      return Array.from({length: numNotes}, (_, i) => rootFreqET * Math.pow(2, (i / numNotes)));
    }
    // compute ratios for those semitone intervals by mapping to standard ratios
    const noteRatios = semitoneIntervals.map(si => STANDARD_JI_RATIOS_12[si % 12] || Math.pow(2, si/12));
    return noteRatios.slice(0, numNotes).map(r => rootFreqET * r);
  }
}

// ---------- CHORD SET GENERATION for each division ----------
// Strategy: take CHORD_TYPES_12 intervals and map intervals to division-specific steps by rounding.
// Also include extra chords for 31-EDO.
function buildChordSetsForDivision(N) {
  const sets = {};
  // Map 12-EDO chord types
  for (const [name, intervals] of Object.entries(CHORD_TYPES_12)) {
    const mapped = intervals.map(i => Math.round(i * (N / 12)));
    sets[name] = mapped;
  }
  // Add chords that make sense for microtonal divisions by approximations:
  if (N === 19) {
    // re-map some approximations for 19-EDO
    sets['Major'] = CHORD_TYPES_12['Major'].map(i => Math.round(i * (19 / 12)));
    sets['Minor'] = CHORD_TYPES_12['Minor'].map(i => Math.round(i * (19 / 12)));
  } else if (N === 24) {
    // keep 12 basic plus quarter-tone variants available as separate names (approx)
    sets['Quarter-tone Major'] = CHORD_TYPES_12['Major'].map(i => Math.round(i * (24 / 12)));
    sets['Quarter-tone Minor'] = CHORD_TYPES_12['Minor'].map(i => Math.round(i * (24 / 12)));
  } else if (N === 31) {
    // Use mapping plus include extra chords
    for (const [k, v] of Object.entries(EXTRA_CHORDS_31)) {
      sets[k] = v.slice(); // use defined step intervals for 31
    }
    // also ensure standard mapped chords exist
    for (const k of Object.keys(CHORD_TYPES_12)) {
      sets[k] = CHORD_TYPES_12[k].map(i => Math.round(i * (31 / 12)));
    }
  }
  return sets;
}

// ---------- UI BUILD / RENDER ----------

function populateDivisionOptions() {
  divisionSelect.innerHTML = '';
  DIVISIONS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d}`;
    divisionSelect.appendChild(opt);
  });
  divisionSelect.value = currentDivision;
}

function populateKeyOptions() {
  keySelect.innerHTML = '';
  noteNames.forEach((nm, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = nm;
    keySelect.appendChild(opt);
  });
  // keep current selection if possible (else default to 0)
  if (keySelect.options.length > 0) keySelect.selectedIndex = 0;
}

function populateChordTypeOptions() {
  typeSelect.innerHTML = '';
  const keys = Object.keys(chordSets);
  keys.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    typeSelect.appendChild(opt);
  });
  if (typeSelect.options.length > 0) typeSelect.selectedIndex = 0;
}

function buildNoteCircle() {
  circleContainer.innerHTML = '';
  const N = currentDivision;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    const x = NOTE_RADIUS + NOTE_RADIUS * Math.cos(angle) + 30; // container offset
    const y = NOTE_RADIUS + NOTE_RADIUS * Math.sin(angle) + 30;
    const div = document.createElement('div');
    div.className = 'note';
    div.style.left = `${x - 28}px`;
    div.style.top = `${y - 28}px`;
    // structure: name (bigger) + freq (smaller)
    const nameEl = document.createElement('div');
    nameEl.className = 'note-name';
    nameEl.textContent = noteNames[i];
    const freqEl = document.createElement('div');
    freqEl.className = 'note-freq';
    freqEl.textContent = ''; // filled by updateFrequenciesDisplay

    div.appendChild(nameEl);
    div.appendChild(freqEl);

    // optional: click a note to play single note (nice UX)
    div.addEventListener('click', () => {
      const useJI = tuningSwitch.checked;
      const freq = useJI ? jiApproxFrequencies[i] : etFrequencies[i];
      playSingleNote(freq);
    });

    circleContainer.appendChild(div);
  }
  // apply some CSS via JS if not already in CSS file (you should keep styling in CSS)
}

// ---------- Update displays ----------
function updateFrequenciesDisplay() {
  const useJI = tuningSwitch.checked;
  const N = currentDivision;
  const freqArr = useJI ? jiApproxFrequencies : etFrequencies;
  const nodes = circleContainer.querySelectorAll('.note');
  nodes.forEach((node, i) => {
    const f = freqArr[i];
    const freqEl = node.querySelector('.note-freq');
    freqEl.textContent = `${f.toFixed(2)} Hz`;
  });
}

function updateActiveNotesDisplay(activeIndexes = []) {
  const nodes = circleContainer.querySelectorAll('.note');
  nodes.forEach((node, i) => {
    if (activeIndexes.includes(i)) {
      node.classList.add('active');
    } else {
      node.classList.remove('active');
    }
  });
}

// ---------- CHORD selection & playback ----------

function getSelectedRootIndex() {
  return parseInt(keySelect.value, 10) || 0;
}
function getSelectedChordType() {
  return typeSelect.value;
}

// returns array of step indexes for chord in current division
function getChordStepIndexes() {
  const root = getSelectedRootIndex();
  const type = getSelectedChordType();
  const intervals = chordSets[type];
  if (!intervals) return [];
  return intervals.map(i => ((root + i) % currentDivision + currentDivision) % currentDivision);
}

// Play single note for click-on-note
function playSingleNote(freq) {
  if (!freq || !isFinite(freq)) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.2);
}

// Play chord in ET or JI depending on toggle
function playCurrentChord() {
  const steps = getChordStepIndexes();
  if (!steps || !steps.length) return;
  const useJI = tuningSwitch.checked;
  updateActiveNotesDisplay(steps);

  if (useJI) {
    // JI playback: compute JI frequencies relative to root (preferred)
    const rootStep = getSelectedRootIndex();
    const chordType = getSelectedChordType();
    const jiFreqs = computeJIFrequenciesForChord(rootStep, chordType, steps.length);
    // play jiFreqs (map each freq to play)
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    jiFreqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.5);
    });
    // Also update displayed frequencies to JI-approx for whole circle
    updateFrequenciesDisplay();
  } else {
    // ET playback: use etFrequencies for the step indexes
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    steps.forEach(s => {
      const freq = etFrequencies[s];
      if (!freq) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.5);
    });
    // Ensure frequencies show ET numbers
    updateFrequenciesDisplay();
  }
}

// ---------- INITIALIZATION & EVENT HOOKS ----------

function rebuildAllForDivision(N) {
  currentDivision = N;
  // generate note names
  noteNames = generateNoteNamesForDivision(N);
  // frequencies
  etFrequencies = computeETFrequencies(N);
  jiApproxFrequencies = computeJIApproxFrequencies(N);
  // chord sets
  chordSets = buildChordSetsForDivision(N);
  // rebuild UI
  populateKeyOptions();
  populateChordTypeOptions();
  buildNoteCircle();
  updateFrequenciesDisplay();
  updateActiveNotesDisplay([]);
}

// populate division selector first
populateDivisionOptions();
divisionSelect.addEventListener('change', () => {
  const val = parseInt(divisionSelect.value, 10) || DEFAULT_DIVISION;
  rebuildAllForDivision(val);
});

// tuning switch: unchecked = ET (left), checked = JI (right)
tuningSwitch.addEventListener('change', () => {
  // when toggled, we show JI approx frequencies for the whole circle or ET frequencies
  updateFrequenciesDisplay();
});

// run when key or chord type changes: highlight & auto-play
[keySelect, typeSelect].forEach(el => {
  el.addEventListener('change', () => {
    // auto-play on selection change:
    playCurrentChord();
  });
});

// play button
playBtn.addEventListener('click', () => {
  playCurrentChord();
});

// initialize
rebuildAllForDivision(DEFAULT_DIVISION);

});
