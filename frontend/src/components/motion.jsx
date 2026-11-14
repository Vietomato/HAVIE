import React from 'react';
import { LazyMotion, MotionConfig, m } from 'framer-motion';

// Same easing curve as --ease in theme.css so CSS and JS motion feel like one system.
const EASE = [0.2, 0, 0, 1];

const loadFeatures = () => import('./motionFeatures.js').then((module) => module.default);

// Loads only the DOM animation features (smaller bundle) and honours the OS
// "reduce motion" setting for every animation below.
export function MotionProvider({ children }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

const viewport = { once: true, margin: '0px 0px -60px 0px' };

// Fades and lifts an element into view the first time it scrolls on screen.
export function Reveal({ as = 'div', y = 28, delay = 0, children, ...props }) {
  const Tag = m[as];
  return (
    <Tag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 0.6, delay, ease: EASE }}
      {...props}
    >
      {children}
    </Tag>
  );
}

// Wrapper for grid cells: the entrance animation lives on this wrapper so the
// card inside keeps its own CSS hover transform untouched.
export function RevealItem({ index = 0, children, className = '' }) {
  return (
    <Reveal className={('reveal-cell ' + className).trim()} y={24} delay={(index % 4) * 0.07}>
      {children}
    </Reveal>
  );
}

// Soft fade-and-slide when the route changes.
export function PageTransition({ routeKey, children }) {
  return (
    <m.div
      key={routeKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

export { m };
