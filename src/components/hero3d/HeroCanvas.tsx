import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import {
  ClayPencil,
  ClayNotebook,
  ClayStapler,
  ClayEraser,
  ClayStockStack,
  ClayPaperclip
} from './StationeryModels';
import { useDB } from '../../db/store';
import { ErrorBoundary } from '../ErrorBoundary';

interface HeroCanvasProps {
  hoveredModule?: string | null;
}

// Interactive Camera Rig with Mouse Parallax and Smooth Scroll Fly-through
const CameraRig: React.FC = () => {
  const { camera } = useThree();
  const mousePos = useRef({ x: 0, y: 0 });
  const scrollY = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleScroll = () => {
      scrollY.current = window.scrollY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useFrame((_state, delta) => {
    // Parallax target
    const targetX = mousePos.current.x * 0.8;
    const targetY = mousePos.current.y * 0.6 + 0.2;
    // Scroll dolly
    const scrollOffset = Math.min(scrollY.current * 0.003, 3);
    const targetZ = 8.5 + scrollOffset;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY - scrollOffset * 0.4, 3.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);

    camera.lookAt(0, 0, 0);
  });

  return null;
};

// Main 3D Scene Container
const SceneContent: React.FC<{ hoveredModule?: string | null; isDark: boolean }> = ({ hoveredModule, isDark }) => {
  return (
    <>
      <CameraRig />

      {/* Balanced Studio 3-Point Lighting */}
      <ambientLight intensity={isDark ? 0.7 : 0.9} />
      <directionalLight
        position={[6, 8, 5]}
        intensity={isDark ? 1.4 : 1.8}
        color={isDark ? '#E0E7FF' : '#FFFDF5'}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={[-6, 4, -3]}
        intensity={isDark ? 0.6 : 0.8}
        color={isDark ? '#818CF8' : '#C7D2FE'}
      />
      <hemisphereLight
        args={[isDark ? '#312E81' : '#EEF2FF', isDark ? '#1E1B4B' : '#E0E7FF', isDark ? 0.6 : 0.8]}
      />

      {/* Floating 3D Stationery Cluster */}
      <group position={[0, 0, 0]}>
        {/* Notebook (Center Left) */}
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
          <ClayNotebook
            position={[-2.3, 0.4, 0.2]}
            rotation={[0.2, 0.4, -0.1]}
            scale={0.95}
            hoveredModule={hoveredModule}
            moduleId="items"
          />
        </Float>

        {/* Yellow Pencil (Tilted) */}
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
          <ClayPencil
            position={[-0.8, -0.6, 1.2]}
            rotation={[0.3, 0.2, -0.6]}
            scale={0.9}
            hoveredModule={hoveredModule}
            moduleId="search"
          />
        </Float>

        {/* Mint Stapler (Center Right) */}
        <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.4}>
          <ClayStapler
            position={[2.2, 0.6, 0.4]}
            rotation={[-0.2, -0.5, 0.15]}
            scale={0.95}
            hoveredModule={hoveredModule}
            moduleId="issues"
          />
        </Float>

        {/* Stack of Stock Boxes (Center Depth) */}
        <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.3}>
          <ClayStockStack
            position={[0.2, -0.8, -0.5]}
            rotation={[0.1, -0.3, 0]}
            scale={1.1}
            hoveredModule={hoveredModule}
            moduleId="stock"
          />
        </Float>

        {/* Dual-Color Eraser */}
        <Float speed={2.2} rotationIntensity={0.4} floatIntensity={0.6}>
          <ClayEraser
            position={[1.6, -1.6, 1.0]}
            rotation={[0.4, 0.3, 0.5]}
            scale={0.85}
          />
        </Float>

        {/* Stylized Rose Paperclip */}
        <Float speed={2.5} rotationIntensity={0.5} floatIntensity={0.6}>
          <ClayPaperclip
            position={[-2.8, -1.2, 0.8]}
            rotation={[0.2, 0.4, 0.8]}
            scale={0.8}
          />
        </Float>
      </group>

      {/* Soft Contact Shadow Grounding */}
      <ContactShadows
        position={[0, -2.6, 0]}
        opacity={isDark ? 0.55 : 0.4}
        scale={16}
        blur={2.4}
        far={5}
      />
    </>
  );
};

export const HeroCanvas: React.FC<HeroCanvasProps> = ({ hoveredModule }) => {
  const { theme } = useDB();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-grab active:cursor-grabbing">
      <ErrorBoundary
        name="Hero 3D Canvas"
        fallback={
          <div className="w-full h-full bg-gradient-to-br from-indigo-100/40 via-purple-50/20 to-pink-50/30 dark:from-slate-900/60 dark:to-indigo-950/30 rounded-3xl" />
        }
      >
        <Canvas
          frameloop={inView ? 'always' : 'never'}
          camera={{ position: [0, 0.2, 8.5], fov: 38 }}
          dpr={[1, 1.75]} // capped for high performance
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          shadows
        >
          <Suspense fallback={null}>
            <SceneContent hoveredModule={hoveredModule} isDark={theme === 'dark'} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
};
