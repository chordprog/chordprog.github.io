document.addEventListener('DOMContentLoaded', () => {
  // ---------- CONFIG & DATA ----------
  const DIVISIONS = [12, 19, 24, 31];
  const DEFAULT_DIVISION = 12;
  const BASE_FREQ_C4 = 261.63;
  const NOTE_RADIUS = 300;

  // ---------- MANUAL NOTE NAMING ----------
  const NOTE_NAMES_BY_DIVISION = {
    12: [
      'C', 'C♯', 'D', 'D♯', 'E', 'F',
      'F♯', 'G', 'G♯', 'A', 'A♯', 'B'
    ],
    19: [
      'C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'E♯', 'F',
      'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B', 'B♯'
    ],
    24: [
      'C', 'C𝄲', 'C♯', 'D𝄳', 'D', 'D𝄲', 'D♯', 'E𝄳',
      'E', 'E𝄲', 'F', 'F𝄲', 'F♯', 'G𝄳', 'G', 'G𝄲',
      'G♯', 'A𝄳', 'A', 'A𝄲', 'A♯', 'B𝄳', 'B', 'B𝄲'
    ],
    31: [
      'C', 'D𝄫', 'C♯', 'D♭', 'C𝄪', 'D', 'E𝄫', 'D♯', 'E♭', 'D𝄪',
      'E', 'F♭', 'E♯', 'F', 'G𝄫', 'F♯', 'G♭', 'F𝄪', 'G', 'A𝄫',
      'G♯', 'A♭', 'G𝄪', 'A', 'B𝄫', 'A♯', 'B♭', 'A𝄪', 'B', 'C♭', 'B♯'
    ]
  };

  function getNoteNamesForDivision(N) {
    const names = NOTE_NAMES_BY_DIVISION[N];
    if (!names) {
      console.warn(`No manual note names defined for division ${N}`);
      return Array.from({ length: N }, (_, i) => `Step ${i + 1}`);
    }
    return names;
  }

  // ---------- CHORDS & RATIOS ----------
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

  const EXTRA_CHORDS_31 = {
    'Supermajor': [0, 9, 13],
    'Subminor': [0, 6, 13],
  };

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

  // ---------- DOM ELEMENTS ----------
  const divisionSelect = document.getElementById('division-select');
  const keySelect = document.getElementById('key-select');
  const typeSelect = document.getElementById('type-select');
  const tuningSwitch = document.getElementById('tuning-switch');
  const playBtn = document.getElementById('play-btn');
  const circleContainer = document.getElementById('note-circle');

  if (!divisionSelect || !keySelect || !typeSelect || !tuningSwitch || !playBtn || !circleContainer) {
    console.error('One or more required DOM elements are missing.');
    return;
  }

  // ---------- STATE ----------
  let currentDivision = DEFAULT_DIVISION;
  let noteNames = [];
  let etFrequencies = [];
  let jiApproxFrequencies = [];
  let chordSets = {};

  // ---------- AUDIO ----------
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  window.addEventListener('click', () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  });

  // ---------- UTIL: frequency calculations ----------
  function computeETFrequencies(N) {
    return Array.from({ length: N }, (_, s) => BASE_FREQ_C4 * Math.pow(2, s / N));
  }

  function computeJIApproxFrequencies(N) {
    return Array.from({ length: N }, (_, s) => {
      const semitonePos = s * (12 / N);
      const semitoneIndexRound = Math.round(semitonePos);
      const octaveOffset = Math.floor(semitonePos / 12);
      const jiRatio = STANDARD_JI_RATIOS_12[((semitoneIndexRound % 12) + 12) % 12];
      return BASE_FREQ_C4 * jiRatio * Math.pow(2, octaveOffset);
    });
  }

  function computeJIFrequenciesForChord(rootStep, chordType, numNotes) {
    const rootFreqET = etFrequencies[rootStep];
    const ratios = CHORD_JI_RATIOS[chordType];
    if (ratios && ratios.length >= numNotes) {
      return ratios.slice(0, numNotes).map(r => rootFreqET * r);
    } else if (ratios && ratios.length < numNotes) {
      return Array.from({ length: numNotes }, (_, i) => rootFreqET * ratios[Math.min(i, ratios.length - 1)]);
    } else {
      const semitoneIntervals = CHORD_TYPES_12[chordType];
      if (!semitoneIntervals) return Array.from({ length: numNotes }, (_, i) => rootFreqET * Math.pow(2, i / numNotes));
      const noteRatios = semitoneIntervals.map(si => STANDARD_JI_RATIOS_12[si % 12] || Math.pow(2, si / 12));
      return noteRatios.slice(0, numNotes).map(r => rootFreqET * r);
    }
  }

  // ---------- CHORD SETS ----------
  function buildChordSetsForDivision(N) {
    const sets = {};
    for (const [name, intervals] of Object.entries(CHORD_TYPES_12)) {
      sets[name] = intervals.map(i => Math.round(i * (N / 12)));
    }
    if (N === 31) {
      for (const [k, v] of Object.entries(EXTRA_CHORDS_31)) {
        sets[k] = v.slice();
      }
    }
    return sets;
  }

  // ---------- UI BUILD ----------
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
    Object.keys(chordSets).forEach(k => {
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
    const angleStep = (2 * Math.PI) / N;
    const fontScale = Math.max(0.55, 1.05 - (N - 12) * 0.02);
    const nameFontSize = `${(fontScale * 1.25).toFixed(2)}em`;
    const freqFontSize = `${(fontScale * 0.72).toFixed(2)}em`;

    for (let i = 0; i < N; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = Math.cos(angle) * NOTE_RADIUS;
      const y = Math.sin(angle) * NOTE_RADIUS;

      const div = document.createElement('div');
      div.className = 'note';
      div.style.width = `${Math.max(60, 80 * fontScale)}px`;
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
      freqEl.textContent = '';
      freqEl.style.fontSize = freqFontSize;
      freqEl.style.opacity = '0.85';

      div.appendChild(nameEl);
      div.appendChild(freqEl);

      div.addEventListener('click', e => {
        e.stopPropagation();
        const useJI = tuningSwitch.checked;
        const freq = useJI ? jiApproxFrequencies[i] : etFrequencies[i];
        playSingleNote(freq);
      });

      circleContainer.appendChild(div);
    }
  }

  // ---------- DISPLAY UPDATES ----------
  function updateFrequenciesDisplay() {
    const useJI = tuningSwitch.checked;
    const freqArr = useJI ? jiApproxFrequencies : etFrequencies;
    circleContainer.querySelectorAll('.note').forEach((node, i) => {
      const freqEl = node.querySelector('.note-freq');
      if (freqArr[i] && freqEl) freqEl.textContent = `${freqArr[i].toFixed(2)} Hz`;
    });
  }

  function updateActiveNotesDisplay(activeIndexes = []) {
    circleContainer.querySelectorAll('.note').forEach((node, i) => {
      node.classList.toggle('active', activeIndexes.includes(i));
    });
  }

  // ---------- CHORDS & PLAYBACK ----------
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
    return intervals.map(i => (root + i) % currentDivision);
  }

  function playSingleNote(freq) {
    if (!freq || !isFinite(freq)) return;
    const ctx = getAudioContext();
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
    if (!steps.length) return;
    const useJI = tuningSwitch.checked;
    updateActiveNotesDisplay(steps);

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const freqs = useJI
      ? computeJIFrequenciesForChord(getSelectedRootIndex(), getSelectedChordType(), steps.length)
      : steps.map(s => etFrequencies[s]);

    freqs.forEach(freq => {
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

  // ---------- INITIALIZATION ----------
  function rebuildAllForDivision(N) {
    currentDivision = N;
    noteNames = getNoteNamesForDivision(N);
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
    rebuildAllForDivision(parseInt(divisionSelect.value, 10) || DEFAULT_DIVISION);
  });

  tuningSwitch.addEventListener('change', () => updateFrequenciesDisplay());
  keySelect.addEventListener('change', () => playCurrentChord());
  typeSelect.addEventListener('change', () => playCurrentChord());
  playBtn.addEventListener('click', () => playCurrentChord());

  rebuildAllForDivision(DEFAULT_DIVISION);
});
