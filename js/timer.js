/**
 * HiitHero - Timer State Machine
 * Pure logic module with no DOM dependencies.
 * Communicates via callbacks.
 *
 * States: IDLE -> COUNTDOWN -> WORK <-> REST -> COMPLETE
 *         Any running state -> PAUSED -> resume to previous state
 */
function createTimer(config, callbacks) {
  var STATES = {
    IDLE: 'IDLE',
    COUNTDOWN: 'COUNTDOWN',
    WORK: 'WORK',
    REST: 'REST',
    PAUSED: 'PAUSED',
    COMPLETE: 'COMPLETE'
  };

  var state = {
    status: STATES.IDLE,
    previousStatus: null,
    currentRound: 1,
    totalRounds: config.rounds,
    timeRemaining: 0,
    phaseDuration: 0
  };

  var rafId = null;
  var lastTimestamp = null;
  var lastDisplayedSecond = null;

  function emitTick() {
    callbacks.onTick({
      timeRemaining: state.timeRemaining,
      phaseDuration: state.phaseDuration,
      status: state.status,
      currentRound: state.currentRound,
      totalRounds: state.totalRounds
    });
  }

  function tick(timestamp) {
    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
    }

    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Cap delta to prevent huge jumps (e.g., after tab was backgrounded)
    if (delta > 1000) {
      delta = 1000;
    }

    state.timeRemaining -= delta;

    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      emitTick();
      handlePhaseEnd();
      return;
    }

    // Check for countdown tick sounds (at 3, 2, 1 seconds remaining)
    var currentSecond = Math.ceil(state.timeRemaining / 1000);
    if (currentSecond !== lastDisplayedSecond) {
      lastDisplayedSecond = currentSecond;
      if (currentSecond <= 3 && currentSecond >= 1 && state.status !== STATES.COUNTDOWN) {
        callbacks.onSound('countdown');
      }
    }

    emitTick();
    rafId = requestAnimationFrame(tick);
  }

  function handlePhaseEnd() {
    if (state.status === STATES.COUNTDOWN) {
      // Countdown finished -> start first work interval
      state.status = STATES.WORK;
      state.timeRemaining = config.workDuration * 1000;
      state.phaseDuration = state.timeRemaining;
      lastDisplayedSecond = null;
      callbacks.onPhaseChange(STATES.WORK);
      callbacks.onSound('start');
      rafId = requestAnimationFrame(tick);

    } else if (state.status === STATES.WORK) {
      if (state.currentRound >= state.totalRounds) {
        // All rounds done
        state.status = STATES.COMPLETE;
        callbacks.onComplete({
          rounds: state.totalRounds,
          workDuration: config.workDuration,
          restDuration: config.restDuration
        });
        callbacks.onSound('complete');
        callbacks.onStateChange(STATES.COMPLETE);
      } else {
        // Transition to rest
        state.status = STATES.REST;
        state.timeRemaining = config.restDuration * 1000;
        state.phaseDuration = state.timeRemaining;
        lastDisplayedSecond = null;
        callbacks.onPhaseChange(STATES.REST);
        callbacks.onSound('workToRest');
        rafId = requestAnimationFrame(tick);
      }

    } else if (state.status === STATES.REST) {
      // Rest finished -> next work round
      state.currentRound += 1;
      state.status = STATES.WORK;
      state.timeRemaining = config.workDuration * 1000;
      state.phaseDuration = state.timeRemaining;
      lastDisplayedSecond = null;
      callbacks.onPhaseChange(STATES.WORK);
      callbacks.onRoundChange(state.currentRound, state.totalRounds);
      callbacks.onSound('restToWork');
      rafId = requestAnimationFrame(tick);
    }
  }

  function start() {
    if (state.status !== STATES.IDLE) return;

    state.currentRound = 1;
    state.totalRounds = config.rounds;
    state.status = STATES.COUNTDOWN;
    state.timeRemaining = 3000; // 3-second countdown
    state.phaseDuration = 3000;
    lastTimestamp = null;
    lastDisplayedSecond = null;

    callbacks.onPhaseChange(STATES.COUNTDOWN);
    callbacks.onRoundChange(state.currentRound, state.totalRounds);
    callbacks.onStateChange(STATES.COUNTDOWN);

    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    var s = state.status;
    if (s !== STATES.COUNTDOWN && s !== STATES.WORK && s !== STATES.REST) return;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    state.previousStatus = state.status;
    state.status = STATES.PAUSED;
    callbacks.onStateChange(STATES.PAUSED);
  }

  function resume() {
    if (state.status !== STATES.PAUSED || !state.previousStatus) return;

    state.status = state.previousStatus;
    state.previousStatus = null;
    lastTimestamp = null; // Reset so delta doesn't include pause duration

    callbacks.onStateChange(state.status);
    rafId = requestAnimationFrame(tick);
  }

  function reset() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    state.status = STATES.IDLE;
    state.previousStatus = null;
    state.currentRound = 1;
    state.timeRemaining = 0;
    state.phaseDuration = 0;
    lastTimestamp = null;
    lastDisplayedSecond = null;

    callbacks.onStateChange(STATES.IDLE);
  }

  function skip() {
    var s = state.status;

    // If paused, restore the previous status so we can skip it
    if (s === STATES.PAUSED && state.previousStatus) {
      state.status = state.previousStatus;
      state.previousStatus = null;
      s = state.status;
    }

    if (s !== STATES.WORK && s !== STATES.REST && s !== STATES.COUNTDOWN) return;

    // Force current phase to end
    state.timeRemaining = 0;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    handlePhaseEnd();
  }

  function getState() {
    return {
      status: state.status,
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      timeRemaining: state.timeRemaining,
      phaseDuration: state.phaseDuration
    };
  }

  return {
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,
    skip: skip,
    getState: getState,
    STATES: STATES
  };
}
