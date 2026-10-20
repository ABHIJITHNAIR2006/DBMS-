import React, { useRef, useEffect } from 'react';
import { motion, HTMLMotionProps, useMotionValue, useSpring, useTransform } from 'motion/react';

export interface ClayCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  enableTilt?: boolean;
  flat?: boolean;
  className?: string;
  glowColor?: string;
}

export const ClayCard = React.memo<ClayCardProps>(({
  children,
  enableTilt = false,
  flat = false,
  className = '',
  glowColor,
  style,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  // Motion values for smooth 60fps tilt without React state re-renders
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springConfig = { stiffness: 350, damping: 25 };
  const smoothX = useSpring(rawX, springConfig);
  const smoothY = useSpring(rawY, springConfig);

  // Map normalized [-1, 1] offset to rotation degrees [-6, 6]
  const rotateX = useTransform(smoothY, [-1, 1], [6, -6]);
  const rotateY = useTransform(smoothX, [-1, 1], [-6, 6]);

  const isCoarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldTilt = enableTilt && !isCoarse && !prefersReduced;

  const handleMouseEnter = () => {
    if (!shouldTilt || !cardRef.current) return;
    rectRef.current = cardRef.current.getBoundingClientRect();
    cardRef.current.classList.add('clay-tilt-active');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldTilt) return;
    if (!rectRef.current && cardRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect();
    }
    const rect = rectRef.current;
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normX = Math.max(-1, Math.min(1, ((x - rect.width / 2) / (rect.width / 2))));
    const normY = Math.max(-1, Math.min(1, ((y - rect.height / 2) / (rect.height / 2))));

    rawX.set(normX);
    rawY.set(normY);

    if (rafRef.current === null && cardRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        if (cardRef.current && rect) {
          const pctX = (x / rect.width) * 100;
          const pctY = (y / rect.height) * 100;
          cardRef.current.style.setProperty('--shine-x', `${pctX}%`);
          cardRef.current.style.setProperty('--shine-y', `${pctY}%`);
        }
        rafRef.current = null;
      });
    }
  };

  const handleMouseLeave = () => {
    if (!shouldTilt) return;
    rawX.set(0);
    rawY.set(0);
    rectRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cardRef.current) {
      cardRef.current.classList.remove('clay-tilt-active');
    }
  };

  useEffect(() => {
    const handleReset = () => {
      rectRef.current = null;
    };
    window.addEventListener('resize', handleReset, { passive: true });
    window.addEventListener('scroll', handleReset, { passive: true });
    return () => {
      window.removeEventListener('resize', handleReset);
      window.removeEventListener('scroll', handleReset);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={shouldTilt ? handleMouseMove : undefined}
      onMouseEnter={shouldTilt ? handleMouseEnter : undefined}
      onMouseLeave={shouldTilt ? handleMouseLeave : undefined}
      style={{
        ...style,
        ...(shouldTilt ? { rotateX, rotateY, transformPerspective: 1000 } : {}),
        ...(glowColor ? { borderColor: glowColor } : {})
      }}
      className={`relative overflow-hidden ${flat ? 'clay-card-flat' : 'clay-card'} p-6 ${className}`}
      {...props}
    >
      {/* Specular highlight via CSS variables --shine-x and --shine-y, zero React re-renders */}
      {shouldTilt && (
        <div
          className="clay-specular-overlay pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.div>
  );
});

ClayCard.displayName = 'ClayCard';
