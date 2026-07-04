import { motion } from 'framer-motion';

// Easing curves
export const EASE_OUT = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];
export const SPRING = { type: 'spring', stiffness: 380, damping: 30 };

// Transition presets
export const transitions = {
  fast: { duration: 0.15, ease: EASE_OUT },
  base: { duration: 0.25, ease: EASE_OUT },
  slow: { duration: 0.4, ease: EASE_OUT },
  spring: SPRING,
  bounce: { type: 'spring', stiffness: 300, damping: 18, mass: 0.8 },
};

// Variant presets — reusable across components
export const variants = {
  // Page transitions
  page: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  // Drawer
  drawerRight: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
  drawerLeft: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  drawerBottom: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
  // Card
  cardHover: {
    initial: { y: 0, scale: 1 },
    hover: { y: -4, scale: 1.01 },
  },
  // Toast
  toast: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 10, scale: 0.95 },
  },
  // Stagger container
  stagger: {
    initial: {},
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
    exit: { transition: { staggerChildren: 0.02 } },
  },
  // List item
  listItem: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  // Success checkmark scale-in
  popIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
  },
  // Loading pulse
  pulse: {
    initial: { opacity: 0.4, scale: 1 },
    animate: { opacity: 1, scale: 1.05 },
  },
};

export const motionFor = (variantKey, transitionKey = 'base') => ({
  variants: variants[variantKey],
  transition: transitions[transitionKey],
});