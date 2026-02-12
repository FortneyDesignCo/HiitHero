/**
 * HiitHero - Application Controller
 * Wires DOM events to timer, sound, and wake lock modules.
 * Handles UI updates, screen transitions, and settings persistence.
 */
(function () {
  'use strict';

  // ---- Constants ----
  var STORAGE_KEY = 'hiithero_settings';
  var CIRCUMFERENCE = 2 * Math.PI * 105; // matches SVG circle r=105

  // ---- DOM References ----
  var dom = {
    // Screens
    setupScreen: document.getElementById('setup-screen'),
    timerScreen: document.getElementById('timer-screen'),
    completeScreen: document.getElementById('complete-screen'),

    // Setup form
    settingsForm: document.getElementById('settings-form'),
    workInput: document.getElementById('work-duration'),
    restInput: document.getElementById('rest-duration'),
    roundsInput: document.getElementById('num-rounds'),
    totalTimeDisplay: document.getElementById('total-time-display'),
    startBtn: document.getElementById('start-btn'),

    // Timer display
    phaseBanner: document.getElementById('phase-banner'),
    phaseLabel: document.getElementById('phase-label'),
    roundDisplay: document.getElementById('round-display'),
    currentRound: document.getElementById('current-round'),
    totalRounds: document.getElementById('total-rounds'),
    timerDisplay: document.getElementById('timer-display'),
    timerSecondsDisplay: document.getElementById('timer-seconds-display'),
    progressFill: document.getElementById('progress-ring__fill'),

    // Controls
    resetBtn: document.getElementById('reset-btn'),
    playpauseBtn: document.getElementById('playpause-btn'),
    skipBtn: document.getElementById('skip-btn'),
    pauseIcon: document.getElementById('pause-icon'),
    playIcon: document.getElementById('play-icon'),

    // Complete
    workoutSummary: document.getElementById('workout-summary'),
    doneBtn: document.getElementById('done-btn')
  };

  // ---- State ----
  var timer = null;
  var isPaused = false;

  // ---- Helper Functions ----

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function sanitizeNumericInput(input, min, max, fallback) {
    var parsed = parseInt(input.value, 10);
    if (isNaN(parsed)) {
      parsed = fallback;
    }
    var value = clamp(parsed, min, max);
    input.value = String(value);
    return value;
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function formatTimerDisplay(ms) {
    var totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds <= 0) totalSeconds = 0;
    return String(totalSeconds);
  }

  function showScreen(screenId) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove('screen--active');
    }
    document.getElementById(screenId).classList.add('screen--active');
  }

  function setPhase(phase) {
    document.body.dataset.phase = phase;
  }

  function updateProgressRing(timeRemaining, phaseDuration) {
    if (phaseDuration <= 0) return;
    var fraction = timeRemaining / phaseDuration;
    var offset = CIRCUMFERENCE * (1 - fraction);
    dom.progressFill.style.strokeDashoffset = offset;
  }

  function showPauseIcon() {
    dom.pauseIcon.classList.remove('control-icon--hidden');
    dom.playIcon.classList.add('control-icon--hidden');
    dom.playpauseBtn.setAttribute('aria-label', 'Pause workout');
  }

  function showPlayIcon() {
    dom.pauseIcon.classList.add('control-icon--hidden');
    dom.playIcon.classList.remove('control-icon--hidden');
    dom.playpauseBtn.setAttribute('aria-label', 'Resume workout');
  }

  // ---- Settings Persistence ----

  function getSettings() {
    return {
      workDuration: sanitizeNumericInput(dom.workInput, 5, 300, 30),
      restDuration: sanitizeNumericInput(dom.restInput, 5, 300, 15),
      rounds: sanitizeNumericInput(dom.roundsInput, 1, 50, 8)
    };
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getSettings()));
    } catch (e) {
      // localStorage not available
    }
  }

  function loadSettings() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var s = JSON.parse(saved);
        if (s.workDuration) dom.workInput.value = clamp(s.workDuration, 5, 300);
        if (s.restDuration) dom.restInput.value = clamp(s.restDuration, 5, 300);
        if (s.rounds) dom.roundsInput.value = clamp(s.rounds, 1, 50);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  function updateTotalTime() {
    var s = getSettings();
    var total = (s.workDuration * s.rounds) + (s.restDuration * (s.rounds - 1));
    dom.totalTimeDisplay.textContent = formatTime(total);
  }

  // ---- Timer Callbacks ----

  function onTick(data) {
    dom.timerSecondsDisplay.textContent = formatTimerDisplay(data.timeRemaining);
    updateProgressRing(data.timeRemaining, data.phaseDuration);

    // Add pulse animation warning when <= 3 seconds left
    var secs = Math.ceil(data.timeRemaining / 1000);
    if (secs <= 3 && data.status !== 'COUNTDOWN') {
      dom.timerDisplay.classList.add('timer-display--countdown-warning');
    } else {
      dom.timerDisplay.classList.remove('timer-display--countdown-warning');
    }
  }

  function onPhaseChange(phase) {
    var phaseMap = {
      COUNTDOWN: { label: 'GET READY', cssPhase: 'countdown' },
      WORK: { label: 'WORK', cssPhase: 'work' },
      REST: { label: 'REST', cssPhase: 'rest' }
    };

    var info = phaseMap[phase];
    if (info) {
      dom.phaseLabel.textContent = info.label;
      setPhase(info.cssPhase);
    }

    dom.timerDisplay.classList.remove('timer-display--countdown-warning');
  }

  function onRoundChange(current, total) {
    dom.currentRound.textContent = current;
    dom.totalRounds.textContent = total;
  }

  function onComplete(data) {
    var totalWork = data.workDuration * data.rounds;
    var totalRest = data.restDuration * (data.rounds - 1);
    var totalTime = totalWork + totalRest + 3; // +3 for countdown

    dom.workoutSummary.textContent =
      data.rounds + ' rounds completed in ' + formatTime(totalTime) +
      ' (' + data.workDuration + 's work / ' + data.restDuration + 's rest)';

    setPhase('idle');
    showScreen('complete-screen');
    WakeLockManager.release();
  }

  function onSound(type) {
    HiitSound.play(type);
  }

  function onStateChange(status) {
    if (status === 'PAUSED') {
      isPaused = true;
      showPlayIcon();
    } else if (status === 'IDLE') {
      isPaused = false;
      setPhase('idle');
      showScreen('setup-screen');
      WakeLockManager.release();
    } else {
      isPaused = false;
      showPauseIcon();
    }
  }

  // ---- Event Handlers ----

  function handleStart(e) {
    e.preventDefault();

    var settings = getSettings();
    saveSettings();

    // Initialize audio on user gesture
    HiitSound.init();

    // Create timer
    timer = createTimer(settings, {
      onTick: onTick,
      onPhaseChange: onPhaseChange,
      onRoundChange: onRoundChange,
      onComplete: onComplete,
      onSound: onSound,
      onStateChange: onStateChange
    });

    // Set initial round display
    dom.currentRound.textContent = '1';
    dom.totalRounds.textContent = settings.rounds;

    // Reset progress ring
    dom.progressFill.style.strokeDashoffset = 0;

    // Switch to timer screen and start
    isPaused = false;
    showPauseIcon();
    showScreen('timer-screen');
    timer.start();
    WakeLockManager.request();
  }

  function handlePlayPause() {
    if (!timer) return;

    if (isPaused) {
      timer.resume();
    } else {
      timer.pause();
    }
  }

  function handleReset() {
    if (!timer) return;
    timer.reset();
    timer = null;
  }

  function handleSkip() {
    if (!timer) return;
    // skip() handles PAUSED state natively, but we need to update the UI
    if (isPaused) {
      isPaused = false;
      showPauseIcon();
    }
    timer.skip();
  }

  function handleDone() {
    setPhase('idle');
    showScreen('setup-screen');
    timer = null;
  }

  function handleStepper(e) {
    var btn = e.target.closest('.stepper__btn');
    if (!btn) return;

    var targetId = btn.dataset.target;
    var delta = parseInt(btn.dataset.delta, 10);
    var input = document.getElementById(targetId);
    if (!input) return;

    var min = parseInt(input.min, 10);
    var max = parseInt(input.max, 10);
    var step = parseInt(input.step, 10) || 1;
    var current = parseInt(input.value, 10) || 0;
    var newValue = clamp(current + delta, min, max);

    input.value = newValue;
    updateTotalTime();
    saveSettings();
  }

  function handleInputChange() {
    updateTotalTime();
    saveSettings();
  }

  // ---- Initialization ----

  function init() {
    // Load saved settings
    loadSettings();
    updateTotalTime();

    // Set initial progress ring circumference
    dom.progressFill.style.strokeDasharray = CIRCUMFERENCE;
    dom.progressFill.style.strokeDashoffset = 0;

    // Event listeners
    dom.settingsForm.addEventListener('submit', handleStart);
    dom.playpauseBtn.addEventListener('click', handlePlayPause);
    dom.resetBtn.addEventListener('click', handleReset);
    dom.skipBtn.addEventListener('click', handleSkip);
    dom.doneBtn.addEventListener('click', handleDone);

    // Stepper buttons (event delegation on the form)
    dom.settingsForm.addEventListener('click', handleStepper);

    // Input changes
    dom.workInput.addEventListener('change', handleInputChange);
    dom.restInput.addEventListener('change', handleInputChange);
    dom.roundsInput.addEventListener('change', handleInputChange);

    // Prevent form resubmission on page refresh
    if (window.history.replaceState) {
      window.history.replaceState(null, null, window.location.href);
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
