/**
 * HiitHero - Wake Lock Module
 * Prevents screen from sleeping during active workouts.
 * Falls back silently if the API is not supported.
 */
var WakeLockManager = (function () {
  var sentinel = null;
  var shouldBeActive = false;

  async function request() {
    if (!('wakeLock' in navigator)) return;
    shouldBeActive = true;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', function () {
        sentinel = null;
      });
    } catch (e) {
      // Wake lock request can fail (e.g., low battery mode).
      // Silently ignore — the timer still works.
    }
  }

  async function release() {
    shouldBeActive = false;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch (e) {
        // Ignore release errors
      }
      sentinel = null;
    }
  }

  function isActive() {
    return sentinel !== null;
  }

  // Re-acquire wake lock when tab becomes visible again
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && shouldBeActive && !sentinel) {
      request();
    }
  });

  return {
    request: request,
    release: release,
    isActive: isActive
  };
})();
