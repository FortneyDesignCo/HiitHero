/**
 * HiitHero - Sound Module
 * Web Audio API tone generation for timer events.
 * No audio files needed — all sounds are synthesized.
 */
var HiitSound = (function () {
  var audioCtx = null;

  function init() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(frequency, duration, waveType, volume, startTime) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  var sounds = {
    start: function () {
      var t = audioCtx.currentTime;
      playTone(440, 0.15, 'sine', 0.4, t);
      playTone(554, 0.15, 'sine', 0.4, t + 0.2);
      playTone(659, 0.3, 'sine', 0.5, t + 0.4);
    },

    workToRest: function () {
      var t = audioCtx.currentTime;
      playTone(880, 0.15, 'triangle', 0.35, t);
      playTone(660, 0.25, 'triangle', 0.4, t + 0.2);
    },

    restToWork: function () {
      var t = audioCtx.currentTime;
      playTone(440, 0.12, 'square', 0.2, t);
      playTone(880, 0.25, 'square', 0.25, t + 0.18);
    },

    complete: function () {
      var t = audioCtx.currentTime;
      playTone(523, 0.2, 'sine', 0.4, t);
      playTone(659, 0.2, 'sine', 0.4, t + 0.25);
      playTone(784, 0.2, 'sine', 0.4, t + 0.5);
      playTone(1047, 0.4, 'sine', 0.5, t + 0.75);
    },

    countdown: function () {
      if (!audioCtx) return;
      playTone(1000, 0.08, 'sine', 0.25, audioCtx.currentTime);
    }
  };

  function play(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (sounds[type]) {
      sounds[type]();
    }
  }

  return {
    init: init,
    play: play
  };
})();
