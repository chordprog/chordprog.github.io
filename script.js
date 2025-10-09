// script.js (updated)
// Adds: fixed larger note circle, font scaling to avoid crowding, defensive null checks,
// keeps existing microtonal, ET/JI, EDO, chord and playback logic intact.

document.addEventListener('DOMContentLoaded', () => {
  // ---------- CONFIG & DATA ----------
  const DIVISIONS = [12, 19, 24, 31];
  const DEFAULT_DIVISION = 12;
  const BASE_FREQ_C4 = 261.63; // reference frequency for C (step 0)
  const NOTE_RADIUS = 300;     // <- larger fixed circle radius (keeps circle same size regardless of division)

  // Standard 12-EDO semitone names (used as base)
  const SEMITONE_NAMES_12 = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

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
    'Supermajor':  [1, 9/8, 13/8],
    'Subminor':    [1, 6/5, 13/8]
  };

  // ---------- DOM ELEMENTS (must match your HTML IDs) ----------
  const divisionSelect = document.getElementById('division-select');
  const keySelect = document.getElementById('key-select');
  const typeSelect = document.getElementById('type-select');
  const tuningSwitch = document.getElementById('tuning-switch'); // unchecked = ET (left), checked = JI (right)
  const playBtn = document.getElementById('play-btn');
  const circleContainer = document.getElementById('note-circle');

  // Defensive: if any required DOM element is missing, log and stop further initialization.
  if (!divisionSelect || !keySelect || !typeSelect || !tuningSwitch || !playBtn || !circleContainer) {
    console.error('One or more required DOM elements are missing. Ensure IDs: division-select, key-select, type-select, tuning-switch, play-btn, note-circle exist in HTML.');
    return;
  }

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

// ---------- UTIL: microtonal note naming (UPDATED) ----------
function generateNoteNamesForDivision(N) {
  const names = [];
  // threshold (in fractional semitone units) to decide "near half"
  const HALF_THRESHOLD = 0.20; // ±20% of a semitone around 0.5 (adjust if you want stricter)
  // threshold to decide "near integer semitone"
  const NATURAL_THRESHOLD = 0.125;

  for (let s = 0; s < N; s++) {
    const semitonePos = s * (12 / N);        // position in 12-EDO semitone units
    const base = Math.floor(semitonePos);
    const semitoneIndex = ((base % 12) + 12) % 12;
    let frac = semitonePos - base;           // frac in [0, 1)

    let label = '';

    // 1) If very close to the lower integer semitone -> natural of base
    if (frac < NATURAL_THRESHOLD) {
      label = SEMITONE_NAMES_12[semitoneIndex];

    // 2) If very close to the upper integer semitone -> label as next semitone natural
    } else if ((1 - frac) < NATURAL_THRESHOLD) {
      const nextIndex = (semitoneIndex + 1) % 12;
      label = SEMITONE_NAMES_12[nextIndex];

    // 3) If near the half-step (e.g. 0.5 ± HALF_THRESHOLD) -> prefer lower-sem note half-sharp (𝄲)
    } else if (Math.abs(frac - 0.5) <= HALF_THRESHOLD) {
      // Represent as LOWER semitone + half-sharp (preferred)
      label = `${SEMITONE_NAMES_12[semitoneIndex]}𝄲`;

    // 4) Otherwise fallback to showing cents offset (rare for chosen EDOs)
    } else {
      const cents = frac * 100;
      label = `${SEMITONE_NAMES_12[semitoneIndex]} (${cents.toFixed(1)}c)`;
    }

    names.push(label);
  }
  return names;
}

  // ---------- UTIL: frequency calculations ----------
  function computeETFrequencies(N) {
    const arr = [];
    for (let s = 0; s < N; s++) {
      arr.push(BASE_FREQ_C4 * Math.pow(2, s / N));
    }
    return arr;
  }

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

  function computeJIFrequenciesForChord(rootStep, chordType, numNotes) {
    const rootFreqET = etFrequencies[rootStep]; // anchor root frequency (ET reference)
    const ratios = CHORD_JI_RATIOS[chordType];
    if (ratios && ratios.length >= numNotes) {
      return ratios.slice(0, numNotes).map(r => rootFreqET * r);
    } else if (ratios && ratios.length < numNotes) {
      const out = [];
      for (let i = 0; i < numNotes; i++) {
        const r = ratios[Math.min(i, ratios.length - 1)];
        out.push(rootFreqET * r);
      }
      return out;
    } else {
      const semitoneIntervals = CHORD_TYPES_12[chordType];
      if (!semitoneIntervals) {
        return Array.from({length: numNotes}, (_, i) => rootFreqET * Math.pow(2, (i / numNotes)));
      }
      const noteRatios = semitoneIntervals.map(si => STANDARD_JI_RATIOS_12[si % 12] || Math.pow(2, si/12));
      return noteRatios.slice(0, numNotes).map(r => rootFreqET * r);
    }
  }

  // ---------- CHORD SET GENERATION for each division ----------
  function buildChordSetsForDivision(N) {
    const sets = {};
    for (const [name, intervals] of Object.entries(CHORD_TYPES_12)) {
      const mapped = intervals.map(i => Math.round(i * (N / 12)));
      sets[name] = mapped;
    }
    if (N === 19) {
      sets['Major'] = CHORD_TYPES_12['Major'].map(i => Math.round(i * (19 / 12)));
      sets['Minor'] = CHORD_TYPES_12['Minor'].map(i => Math.round(i * (19 / 12)));
    } else if (N === 24) {
      sets['Quarter-tone Major'] = CHORD_TYPES_12['Major'].map(i => Math.round(i * (24 / 12)));
      sets['Quarter-tone Minor'] = CHORD_TYPES_12['Minor'].map(i => Math.round(i * (24 / 12)));
    } else if (N === 31) {
      for (const [k, v] of Object.entries(EXTRA_CHORDS_31)) {
        sets[k] = v.slice();
      }
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

  // Build note circle: fixed-size radius NOTE_RADIUS, centered using 50% + offsets.
  // Adds font scaling to reduce overlap at high divisions.
  function buildNoteCircle() {
    if (!circleContainer) return;
    circleContainer.innerHTML = '';

    const N = currentDivision;
    const angleStep = (2 * Math.PI) / N;

    // Font scale: reduce slightly as N increases
    const fontScale = Math.max(0.55, 1.05 - (N - 12) * 0.02); // 12->~1.05, 31->~0.63
    const nameFontSize = `${(fontScale * 1.05).toFixed(2)}em`;
    const freqFontSize = `${(fontScale * 0.72).toFixed(2)}em`;

    for (let i = 0; i < N; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = Math.cos(angle) * NOTE_RADIUS;
      const y = Math.sin(angle) * NOTE_RADIUS;

      const div = document.createElement('div');
      div.className = 'note';
      // set width/height to allow wrapping but keep small to reduce overlap
      div.style.width = `${Math.max(60, 80 * fontScale)}px`;
      div.style.pointerEvents = 'auto'; // allow clicking
      div.style.left = `calc(50% + ${x}px)`;
      div.style.top = `calc(50% + ${y}px)`;
      div.style.transform = 'translate(-50%, -50%)';

      const nameEl = document.createElement('div');
      nameEl.className = 'note-name';
      nameEl.textContent = noteNames[i];
      nameEl.style.fontSize = nameFontSize;
      nameEl.style.fontWeight = '700';
      nameEl.style.whiteSpace = 'nowrap';

      const freqEl = document.createElement('div');
      freqEl.className = 'note-freq';
      freqEl.textContent = ''; // updated later
      freqEl.style.fontSize = freqFontSize;
      freqEl.style.opacity = '0.85';

      div.appendChild(nameEl);
      div.appendChild(freqEl);

      // clicking a note plays the single note
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        const useJI = tuningSwitch.checked;
        const freqArr = useJI ? jiApproxFrequencies : etFrequencies;
        const freq = freqArr && freqArr[i] ? freqArr[i] : null;
        playSingleNote(freq);
      });

      circleContainer.appendChild(div);
    }
  }

  // ---------- Update displays ----------
  function updateFrequenciesDisplay() {
    const useJI = tuningSwitch.checked;
    const freqArr = useJI ? jiApproxFrequencies : etFrequencies;
    const nodes = circleContainer.querySelectorAll('.note');
    nodes.forEach((node, i) => {
      const f = (freqArr && freqArr[i]) ? freqArr[i] : null;
      const freqEl = node.querySelector('.note-freq');
      if (f && freqEl) {
        freqEl.textContent = `${f.toFixed(2)} Hz`;
      } else if (freqEl) {
        freqEl.textContent = '';
      }
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

  function getChordStepIndexes() {
    const root = getSelectedRootIndex();
    const type = getSelectedChordType();
    const intervals = chordSets[type];
    if (!intervals) return [];
    return intervals.map(i => ((root + i) % currentDivision + currentDivision) % currentDivision);
  }

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

  function playCurrentChord() {
    const steps = getChordStepIndexes();
    if (!steps || !steps.length) return;
    const useJI = tuningSwitch.checked;
    updateActiveNotesDisplay(steps);

    if (useJI) {
      const rootStep = getSelectedRootIndex();
      const chordType = getSelectedChordType();
      const jiFreqs = computeJIFrequenciesForChord(rootStep, chordType, steps.length);
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
      updateFrequenciesDisplay();
    } else {
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
      updateFrequenciesDisplay();
    }
  }

  // ---------- INITIALIZATION & EVENT HOOKS ----------
  function rebuildAllForDivision(N) {
    currentDivision = N;
    noteNames = generateNoteNamesForDivision(N);
    etFrequencies = computeETFrequencies(N);
    jiApproxFrequencies = computeJIApproxFrequencies(N);
    chordSets = buildChordSetsForDivision(N);
    populateKeyOptions();
    populateChordTypeOptions();
    buildNoteCircle();
    updateFrequenciesDisplay();
    updateActiveNotesDisplay([]);
  }

  populateDivisionOptions();
  divisionSelect.addEventListener('change', () => {
    const val = parseInt(divisionSelect.value, 10) || DEFAULT_DIVISION;
    rebuildAllForDivision(val);
  });

  tuningSwitch.addEventListener('change', () => {
    updateFrequenciesDisplay();
  });

  [keySelect, typeSelect].forEach(el => {
    el.addEventListener('change', () => {
      playCurrentChord();
    });
  });

  playBtn.addEventListener('click', () => {
    playCurrentChord();
  });

  // initialize
  rebuildAllForDivision(DEFAULT_DIVISION);

}); 
