/** Visual acknowledgement after the server accepts cancellation. */
export async function dissolve(element: HTMLElement | null) {
  if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = element.getBoundingClientRect();
  const particles = Array.from({ length: 18 }, (_, i) => {
    const particle = document.createElement('span');
    const size = 4 + (i % 4) * 2;
    Object.assign(particle.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '90',
      borderRadius: '2px',
      background: 'rgb(var(--accent))',
      width: `${size}px`,
      height: `${size}px`,
      left: `${box.left + box.width * ((i + 0.5) / 18)}px`,
      top: `${box.top + box.height * (0.25 + (i % 3) / 5)}px`,
    });
    document.body.append(particle);
    const animation = particle.animate(
      [
        { opacity: 0.7, transform: 'translate(0,0) rotate(0)' },
        {
          opacity: 0,
          transform: `translate(${20 + i * 3}px, ${-30 - (i % 5) * 14}px) rotate(${i * 35}deg)`,
        },
      ],
      { duration: 450 + (i % 3) * 60, easing: 'ease-out' }
    );
    return animation.finished.catch(() => undefined).finally(() => particle.remove());
  });
  await Promise.all(particles);
}
