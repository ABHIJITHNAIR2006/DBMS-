import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface ObjectProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  hoveredModule?: string | null;
  moduleId?: string;
}

// 1. Procedural 3D Clay Pencil
export const ClayPencil: React.FC<ObjectProps> = ({ position, rotation = [0, 0, 0], scale = 1, hoveredModule, moduleId }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isTargeted = hoveredModule === moduleId;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // Gentle floating bob
    groupRef.current.position.y = position[1] + Math.sin(t * 1.5 + 0.2) * 0.12;
    groupRef.current.rotation.y += delta * 0.3;
    if (isTargeted) {
      groupRef.current.scale.lerp(new THREE.Vector3(scale * 1.25, scale * 1.25, scale * 1.25), 0.1);
    } else {
      groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Yellow Hexagonal Body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 2.6, 6]} />
        <meshStandardMaterial color="#FFD36B" roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Wood cone collar */}
      <mesh castShadow position={[0, -1.55, 0]}>
        <cylinderGeometry args={[0.22, 0.05, 0.5, 16]} />
        <meshStandardMaterial color="#EED1A2" roughness={0.6} />
      </mesh>
      {/* Graphite Tip */}
      <mesh position={[0, -1.85, 0]}>
        <coneGeometry args={[0.06, 0.2, 16]} />
        <meshStandardMaterial color="#33333E" roughness={0.2} metalness={0.4} />
      </mesh>
      {/* Silver Ferrule */}
      <mesh castShadow position={[0, 1.38, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.22, 16]} />
        <meshStandardMaterial color="#D8DEE9" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Pink Eraser Cap */}
      <mesh castShadow position={[0, 1.58, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.26, 16]} />
        <meshStandardMaterial color="#FF8FB1" roughness={0.5} />
      </mesh>
    </group>
  );
};

// 2. Procedural 3D Clay Notebook with Elastic Band
export const ClayNotebook: React.FC<ObjectProps> = ({ position, rotation = [0, 0, 0], scale = 1, hoveredModule, moduleId }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isTargeted = hoveredModule === moduleId;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * 1.3 + 1.2) * 0.1;
    groupRef.current.rotation.x += delta * 0.15;
    if (isTargeted) {
      groupRef.current.scale.lerp(new THREE.Vector3(scale * 1.25, scale * 1.25, scale * 1.25), 0.1);
    } else {
      groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Main Periwinkle Clay Cover */}
      <RoundedBox args={[1.8, 2.4, 0.38]} radius={0.08} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#7C83FF" roughness={0.3} metalness={0.08} />
      </RoundedBox>
      {/* Paper Stack Interior (Cream White) */}
      <RoundedBox args={[1.72, 2.32, 0.3]} radius={0.04} smoothness={2} position={[0.04, 0, 0]}>
        <meshStandardMaterial color="#FAF9F6" roughness={0.8} />
      </RoundedBox>
      {/* Spine Wrap */}
      <mesh position={[-0.88, 0, 0]}>
        <boxGeometry args={[0.1, 2.38, 0.36]} />
        <meshStandardMaterial color="#5E69F6" roughness={0.4} />
      </mesh>
      {/* Coral Elastic Band */}
      <mesh position={[0.5, 0, 0.2]}>
        <boxGeometry args={[0.12, 2.42, 0.04]} />
        <meshStandardMaterial color="#FFA987" roughness={0.5} />
      </mesh>
    </group>
  );
};

// 3. Procedural 3D Clay Stapler
export const ClayStapler: React.FC<ObjectProps> = ({ position, rotation = [0, 0, 0], scale = 1, hoveredModule, moduleId }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isTargeted = hoveredModule === moduleId;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * 1.4 + 2.1) * 0.11;
    groupRef.current.rotation.y += delta * 0.2;
    if (isTargeted) {
      groupRef.current.scale.lerp(new THREE.Vector3(scale * 1.25, scale * 1.25, scale * 1.25), 0.1);
    } else {
      groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Mint Base Plate */}
      <RoundedBox args={[2.2, 0.22, 0.7]} radius={0.06} smoothness={4} position={[0, -0.3, 0]} castShadow>
        <meshStandardMaterial color="#5ED6B0" roughness={0.3} />
      </RoundedBox>
      {/* Chrome Anvil Plate */}
      <mesh position={[-0.6, -0.16, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Upper Mint Arm */}
      <group position={[0.6, -0.15, 0]} rotation={[0, 0, 0.18]}>
        <RoundedBox args={[1.9, 0.38, 0.65]} radius={0.08} smoothness={4} position={[-0.8, 0.25, 0]} castShadow>
          <meshStandardMaterial color="#47C69F" roughness={0.3} />
        </RoundedBox>
        {/* Soft Press Pad on Top */}
        <RoundedBox args={[0.7, 0.1, 0.5]} radius={0.04} smoothness={2} position={[-1.2, 0.47, 0]}>
          <meshStandardMaterial color="#2E8B6D" roughness={0.7} />
        </RoundedBox>
      </group>
    </group>
  );
};

// 4. Procedural 3D Clay Dual-Color Eraser
export const ClayEraser: React.FC<ObjectProps> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * 1.6 + 0.8) * 0.09;
    groupRef.current.rotation.z += delta * 0.25;
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Peach Half */}
      <RoundedBox args={[0.9, 0.4, 0.7]} radius={0.07} smoothness={4} position={[-0.42, 0, 0]} castShadow>
        <meshStandardMaterial color="#FFA987" roughness={0.4} />
      </RoundedBox>
      {/* Cream White Half */}
      <RoundedBox args={[0.9, 0.4, 0.7]} radius={0.07} smoothness={4} position={[0.42, 0, 0]} castShadow>
        <meshStandardMaterial color="#F7F5F0" roughness={0.4} />
      </RoundedBox>
      {/* Blue Paper Sleeve Band */}
      <RoundedBox args={[0.7, 0.44, 0.74]} radius={0.04} smoothness={2} position={[0, 0, 0]}>
        <meshStandardMaterial color="#7C83FF" roughness={0.6} />
      </RoundedBox>
    </group>
  );
};

// 5. Procedural 3D Clay Stack of Stock Boxes (Warehouse Inventory)
export const ClayStockStack: React.FC<ObjectProps> = ({ position, rotation = [0, 0, 0], scale = 1, hoveredModule, moduleId }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isTargeted = hoveredModule === moduleId;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * 1.2 + 2.8) * 0.1;
    groupRef.current.rotation.y += delta * 0.22;
    if (isTargeted) {
      groupRef.current.scale.lerp(new THREE.Vector3(scale * 1.25, scale * 1.25, scale * 1.25), 0.1);
    } else {
      groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Bottom Large Box */}
      <RoundedBox args={[1.5, 0.9, 1.3]} radius={0.08} smoothness={4} position={[0, -0.4, 0]} castShadow>
        <meshStandardMaterial color="#E8BE92" roughness={0.7} />
      </RoundedBox>
      {/* Tape on bottom box */}
      <mesh position={[0, -0.4, 0.66]}>
        <boxGeometry args={[0.2, 0.85, 0.02]} />
        <meshStandardMaterial color="#D4A774" roughness={0.5} />
      </mesh>

      {/* Top Box (slightly rotated) */}
      <group position={[0.1, 0.5, 0]} rotation={[0, 0.25, 0]}>
        <RoundedBox args={[1.2, 0.75, 1.1]} radius={0.06} smoothness={4} castShadow>
          <meshStandardMaterial color="#F0CDA4" roughness={0.7} />
        </RoundedBox>
        {/* Fragile/Label Sticker */}
        <mesh position={[0.3, 0, 0.56]}>
          <boxGeometry args={[0.35, 0.25, 0.02]} />
          <meshStandardMaterial color="#FF8FB1" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
};

// 6. Procedural 3D Clay Paperclip
export const ClayPaperclip: React.FC<ObjectProps> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * 1.8 + 0.5) * 0.12;
    groupRef.current.rotation.y += delta * 0.4;
    groupRef.current.rotation.x += delta * 0.2;
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Outer loop */}
      <mesh castShadow>
        <torusGeometry args={[0.5, 0.07, 16, 32, Math.PI]} />
        <meshStandardMaterial color="#FF6685" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Straight leg */}
      <mesh position={[0.5, -0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.0, 16]} />
        <meshStandardMaterial color="#FF6685" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Inner loop */}
      <mesh position={[-0.2, -0.3, 0]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.3, 0.07, 16, 32, Math.PI]} />
        <meshStandardMaterial color="#FF6685" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
};
