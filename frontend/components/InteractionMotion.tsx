import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function InteractionMotion() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  useEffect(() => {
    const start = () => setNavigating(true);
    const finish = () => {
      setNavigating(false);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelector('main')?.animate(
          [
            { opacity: 0.3, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
      }
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', finish);
    router.events.on('routeChangeError', finish);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', finish);
      router.events.off('routeChangeError', finish);
    };
  }, [router.events]);
  useEffect(() => {
    function feedback(event: PointerEvent | KeyboardEvent) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (event instanceof KeyboardEvent && (!['Enter', ' '].includes(event.key) || event.repeat))
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('button, a[href], [role="option"]')
          : null;
      if (!target || target.matches(':disabled,[aria-disabled="true"]')) return;
      // Preserve layout and hit targets while giving every activation a brief tactile response.
      target.animate(
        [
          { scale: '1' },
          { scale: '.965', offset: 0.3 },
          { scale: '1.012', offset: 0.7 },
          { scale: '1' },
        ],
        { duration: 290, easing: 'cubic-bezier(.2,.7,.2,1)' }
      );
    }
    document.addEventListener('pointerdown', feedback);
    document.addEventListener('keydown', feedback);
    return () => {
      document.removeEventListener('pointerdown', feedback);
      document.removeEventListener('keydown', feedback);
    };
  }, []);
  return (
    <div className={`route-progress ${navigating ? 'is-navigating' : ''}`} aria-hidden>
      <span />
    </div>
  );
}
