import { useEffect } from 'react';

export default function InteractionEffects() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealNodes = new Set();
    let revealObserver;

    const markRevealed = node => {
      if (!node || revealNodes.has(node)) return;
      revealNodes.add(node);
      if (!('IntersectionObserver' in window)) {
        node.classList.add('is-revealed');
        return;
      }
      revealObserver.observe(node);
    };

    if ('IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -32px' });
    }

    const scanReveals = root => {
      if (root?.matches?.('[data-reveal]')) markRevealed(root);
      root?.querySelectorAll?.('[data-reveal]').forEach(markRevealed);
    };
    scanReveals(document);

    const mutationObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) scanReveals(node);
      }));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onPointerDown = event => {
      if (reduceMotion) return;
      const target = event.target.closest?.('[data-ripple], .btn, .chip, .date, .time, .seat');
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      mutationObserver.disconnect();
      revealObserver?.disconnect();
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return null;
}
