import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = 'expo.out';

/**
 * Entrances. Headlines rise line by line out of a mask; supporting copy fades up.
 * Everything here is skipped under reduced motion (the CSS leaves it visible).
 */
export function setupReveals(opts: { heroDelay: number }): () => void {
  const ctx = gsap.context(() => {
    // Headlines.
    document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
      const inHero = Boolean(el.closest('.hero'));
      const inHow = Boolean(el.closest('.how'));
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'line',
        autoSplit: true,
        onSplit(self) {
          el.style.visibility = 'visible';
          if (inHow) return; // the pinned chapter crossfades its copy as a whole
          return gsap.from(self.lines, {
            yPercent: 108,
            duration: inHero ? 1.5 : 1.25,
            ease: EASE,
            stagger: 0.085,
            delay: inHero ? opts.heroDelay : 0,
            scrollTrigger: inHero ? undefined : { trigger: el, start: 'top 86%', once: true },
          });
        },
      });
    });

    // Supporting copy.
    document.querySelectorAll<HTMLElement>('[data-fade]').forEach((el) => {
      const inHero = Boolean(el.closest('.hero'));
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 26 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.3,
          ease: EASE,
          delay: inHero ? opts.heroDelay + 0.45 + (el.classList.contains('actions') ? 0.12 : 0) : 0,
          scrollTrigger: inHero ? undefined : { trigger: el, start: 'top 90%', once: true },
        },
      );
    });

    // Course names, one after another.
    gsap.fromTo(
      '[data-course]',
      { autoAlpha: 0, yPercent: 55 },
      {
        autoAlpha: 1,
        yPercent: 0,
        duration: 1.2,
        ease: EASE,
        stagger: 0.07,
        scrollTrigger: { trigger: '.proof__courses', start: 'top 84%', once: true },
      },
    );

    // The refused verdict is struck through as you read it.
    gsap.fromTo(
      '.verdicts__rule',
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: '.verdicts', start: 'top 72%', end: 'top 38%', scrub: 0.6 },
      },
    );

    // The replay strip fills in.
    ScrollTrigger.create({
      trigger: '.replay',
      start: 'top 82%',
      once: true,
      onEnter: () => document.querySelector('.replay')?.classList.add('is-in'),
    });
  });

  return () => ctx.revert();
}

/** Draws the system diagram's outline chain on with scroll. */
export function drawOnScroll(svg: SVGSVGElement, trigger: Element): () => void {
  const paths = svg.querySelectorAll<SVGPathElement>('.draw');
  const tween = gsap.fromTo(
    paths,
    { strokeDasharray: 1, strokeDashoffset: 1 },
    {
      strokeDashoffset: 0,
      ease: 'none',
      stagger: { each: 0.02 },
      scrollTrigger: { trigger, start: 'top 80%', end: 'top 20%', scrub: 0.8 },
    },
  );
  return () => tween.scrollTrigger?.kill();
}
