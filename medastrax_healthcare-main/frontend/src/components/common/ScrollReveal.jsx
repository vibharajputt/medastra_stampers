import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * A reusable wrapper component that animates its children as they enter the viewport.
 * If direction is 'up' (default), it automatically detects scroll direction:
 * - Scrolling down: slides up from y: 40 to y: 0
 * - Scrolling up: slides down from y: -40 to y: 0
 */
export default function ScrollReveal({ 
  children, 
  direction = 'up', 
  delay = 0, 
  duration = 0.8, 
  once = false,
  className = '' 
}) {
  const [scrollDirection, setScrollDirection] = useState('down');

  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Introduce a small threshold (e.g. 5px) to avoid minor scroll jitter triggering flips
      if (Math.abs(currentScrollY - lastScrollY) > 5) {
        const dir = currentScrollY > lastScrollY ? 'down' : 'up';
        setScrollDirection(dir);
        lastScrollY = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getInitialDirection = () => {
    if (direction === 'up') {
      return { y: scrollDirection === 'down' ? 40 : -40, opacity: 0 };
    }
    
    switch (direction) {
      case 'down': return { y: -40, opacity: 0 };
      case 'left': return { x: 40, opacity: 0 };
      case 'right': return { x: -40, opacity: 0 };
      default: return { y: 40, opacity: 0 };
    }
  };

  const getTargetDirection = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return { y: 0, opacity: 1 };
      case 'left':
      case 'right':
        return { x: 0, opacity: 1 };
      default:
        return { y: 0, opacity: 1 };
    }
  };

  return (
    <motion.div
      initial={getInitialDirection()}
      whileInView={getTargetDirection()}
      viewport={{ once, amount: 0.15 }}
      transition={{ 
        duration, 
        delay, 
        ease: [0.21, 0.47, 0.32, 0.98] // Elegant custom ease-out curve
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
