'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';

const INACTIVITY_MS = 20 * 60 * 1000;  // 20 min idle → show warning
const WARNING_MS   =  2 * 60 * 1000;  // 2 min countdown → auto sign-out

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

export function useInactivityLogout() {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_MS / 1000));

  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningActive = useRef(false);

  const doSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login?reason=idle' });
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
  }, []);

  const startCountdown = useCallback(() => {
    // Guard against double-start (belt-and-suspenders alongside warningActive check)
    if (countdownRef.current) return;

    let remaining = Math.floor(WARNING_MS / 1000);
    setSecondsLeft(remaining);
    setShowWarning(true);
    warningActive.current = true;

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        stopCountdown();
        doSignOut();
      }
    }, 1000);
  }, [doSignOut, stopCountdown]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!warningActive.current) startCountdown();
    }, INACTIVITY_MS);
  }, [startCountdown]);

  const stayLoggedIn = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    warningActive.current = false;
    setSecondsLeft(Math.floor(WARNING_MS / 1000));
    resetIdleTimer();
  }, [stopCountdown, resetIdleTimer]);

  useEffect(() => {
    const onActivity = () => {
      // Ignore activity while warning is showing — user must explicitly choose
      if (warningActive.current) return;
      resetIdleTimer();
    };

    // When the tab becomes visible again after being hidden, reset the idle timer
    // so the countdown doesn't fire based on background-throttled intervals.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !warningActive.current) {
        resetIdleTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopCountdown();
    };
  }, [resetIdleTimer, stopCountdown]);

  return { showWarning, secondsLeft, stayLoggedIn, logOut: doSignOut };
}
