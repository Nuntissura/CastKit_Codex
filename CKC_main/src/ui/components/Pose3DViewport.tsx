import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { HAND_CONNECTIONS, LIMB_PAIRS, applyHeadPose } from '../../posekit/core.mjs';

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

function asKeypoints(rig: unknown, field: 'handLeft' | 'handRight'): Keypoint[] {
  const group = (rig as { handLeft?: Keypoint[]; handRight?: Keypoint[] } | null)?.[field];
  return Array.isArray(group) ? group.filter((kp) => Number(kp?.visibility ?? 0) > 0) : [];
}

function pointToVector(kp: Keypoint, width: number, height: number) {
  return new THREE.Vector3(kp.x - width / 2, height / 2 - kp.y, Number(kp.z || 0) * 0.15);
}

function Bone({ a, b, width, height, color }: { a: Keypoint; b: Keypoint; width: number; height: number; color: string }) {
  const points = React.useMemo(() => [pointToVector(a, width, height), pointToVector(b, width, height)], [a, b, width, height]);
  return <Line points={points} color={color} lineWidth={1.8} />;
}

export function Pose3DViewport({ rig, headPose }: { rig: unknown; headPose: unknown }) {
  const transformedRig = React.useMemo(() => applyHeadPose(rig, headPose as never), [rig, headPose]);
  const raw = transformedRig as { body?: Keypoint[]; handLeft?: Keypoint[]; handRight?: Keypoint[]; canvas?: { width?: number; height?: number } } | null;
  const rawBody = raw?.body || [];
  const rawLeftHand = raw?.handLeft || [];
  const rawRightHand = raw?.handRight || [];
  const body = asBody(transformedRig);
  const leftHand = asKeypoints(transformedRig, 'handLeft');
  const rightHand = asKeypoints(transformedRig, 'handRight');
  const width = Number((transformedRig as { canvas?: { width?: number } } | null)?.canvas?.width || 1024);
  const height = Number((transformedRig as { canvas?: { height?: number } } | null)?.canvas?.height || 1024);

  if (!body.length) {
    return <div style={{ minHeight: 180 }} />;
  }

  return (
    <Canvas camera={{ position: [0, 0, 950], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#111315']} />
      <ambientLight intensity={0.8} />
      <gridHelper args={[900, 12, '#4f6d74', '#22282b']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -180]} />
      <group>
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
        {[
          { key: 'left', raw: rawLeftHand, visible: leftHand, color: '#6fe7ff' },
          { key: 'right', raw: rawRightHand, visible: rightHand, color: '#8df5d2' },
        ].map((hand) => (
          <React.Fragment key={hand.key}>
            {HAND_CONNECTIONS.map(([ai, bi]) => {
              const a = hand.raw[ai];
              const b = hand.raw[bi];
              if (!a || !b || Number(a.visibility || 0) <= 0 || Number(b.visibility || 0) <= 0) return null;
              return <Bone key={`${hand.key}-${ai}-${bi}`} a={a} b={b} width={width} height={height} color={hand.color} />;
            })}
            {hand.visible.map((kp, index) => (
              <mesh key={`${hand.key}-${kp.id || 'hand'}-${index}`} position={pointToVector(kp, width, height)}>
                <sphereGeometry args={[4, 10, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            ))}
          </React.Fragment>
        ))}
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
