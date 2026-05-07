import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { LIMB_PAIRS } from '../../posekit/core.mjs';

type Keypoint = {
  id?: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  estimated?: boolean;
};

function asBody(rig: unknown): Keypoint[] {
  const body = (rig as { body?: Keypoint[] } | null)?.body;
  return Array.isArray(body) ? body.filter((kp) => Number(kp?.visibility ?? 0) > 0) : [];
}

function pointToVector(kp: Keypoint, width: number, height: number) {
  return new THREE.Vector3(kp.x - width / 2, height / 2 - kp.y, Number(kp.z || 0) * 0.15);
}

function Bone({ a, b, width, height, color }: { a: Keypoint; b: Keypoint; width: number; height: number; color: string }) {
  const points = React.useMemo(() => [pointToVector(a, width, height), pointToVector(b, width, height)], [a, b, width, height]);
  return <Line points={points} color={color} lineWidth={1.8} />;
}

export function Pose3DViewport({ rig, yaw }: { rig: unknown; yaw: number }) {
  const rawBody = (rig as { body?: Keypoint[]; canvas?: { width?: number; height?: number } } | null)?.body || [];
  const body = asBody(rig);
  const width = Number((rig as { canvas?: { width?: number } } | null)?.canvas?.width || 1024);
  const height = Number((rig as { canvas?: { height?: number } } | null)?.canvas?.height || 1024);

  if (!body.length) {
    return <div style={{ minHeight: 180 }} />;
  }

  return (
    <Canvas camera={{ position: [0, 0, 950], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#111315']} />
      <ambientLight intensity={0.8} />
      <gridHelper args={[900, 12, '#4f6d74', '#22282b']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -180]} />
      <group rotation={[0, (yaw * Math.PI) / 180, 0]}>
        {LIMB_PAIRS.map(([ai, bi], index) => {
          const a = rawBody[ai];
          const b = rawBody[bi];
          if (!a || !b || Number(a.visibility || 0) <= 0 || Number(b.visibility || 0) <= 0) return null;
          return <Bone key={`${ai}-${bi}`} a={a} b={b} width={width} height={height} color={index < 6 ? '#f0d77a' : '#78a6b2'} />;
        })}
        {body.map((kp, index) => (
          <mesh key={`${kp.id || 'kp'}-${index}`} position={pointToVector(kp, width, height)}>
            <sphereGeometry args={[kp.estimated ? 8 : 6, 12, 12]} />
            <meshBasicMaterial color={kp.estimated ? '#e6a23b' : '#f7f3e8'} />
          </mesh>
        ))}
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
