import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ─── Collage texture ────────────────────────────────────────────
function createCollageTexture(photos, layouts, drawingLayers = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1020;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    let loaded = 0;
    const images = [];
    const drawImages = [];
    // Count total items to load: photos + drawing layers
    const drawingEntries = Object.entries(drawingLayers).filter(([, v]) => v);
    const totalToLoad = photos.length + drawingEntries.length;

    const checkAndDraw = () => {
      if (loaded < totalToLoad) return;

      const cellW = canvas.width / 2;
      const cellH = canvas.height / 5;

      photos.forEach((_, idx) => {
        if (!images[idx]) return;
        const pos = layouts[idx];
        const x = pos.cCol * cellW;
        const y = pos.cRow * cellH;

        const imgAspect = images[idx].width / images[idx].height;
        const cellAspect = cellW / cellH;
        let drawW = cellW, drawH = cellH, offsetX = 0, offsetY = 0;

        if (imgAspect > cellAspect) {
          drawW = cellH * imgAspect;
          offsetX = (drawW - cellW) / 2;
        } else {
          drawH = cellW / imgAspect;
          offsetY = (drawH - cellH) / 2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellW, cellH);
        ctx.clip();
        ctx.drawImage(images[idx], x - offsetX, y - offsetY, drawW, drawH);
        // Overlay drawing layer on top of the photo
        if (drawImages[idx]) {
          ctx.drawImage(drawImages[idx], x, y, cellW, cellH);
        }
        ctx.restore();
      });

      // ─── Fold guide lines with step numbers ───
      const W = canvas.width, H = canvas.height;
      const flapY = ((255 - 75) / 510) * H;

      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 1.5;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(0, flapY);
      ctx.moveTo(W / 2, 0); ctx.lineTo(W, flapY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 4, H);
      ctx.moveTo(W / 2, 0); ctx.lineTo(3 * W / 4, H);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillText('①', W / 4 - 10, flapY / 2);
      ctx.fillText('①', 3 * W / 4 + 10, flapY / 2);
      ctx.fillText('②', W / 2 + 24, H / 2);
      ctx.fillText('③', 3 * W / 8 - 10, (flapY + H) / 2);
      ctx.fillText('③', 5 * W / 8 + 10, (flapY + H) / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
      resolve(texture);
    };

    photos.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => { images[i] = img; loaded++; checkAndDraw(); };
      img.onerror = () => { loaded++; checkAndDraw(); };
    });

    // Load drawing layers
    drawingEntries.forEach(([idxStr, dataUrl]) => {
      const idx = parseInt(idxStr);
      const dImg = new Image();
      dImg.src = dataUrl;
      dImg.onload = () => { drawImages[idx] = dImg; loaded++; checkAndDraw(); };
      dImg.onerror = () => { loaded++; checkAndDraw(); };
    });
  });
}

// ─── Paper geometry (360×510 centered at origin) ────────────────
// Y+255 = top, Y-255 = bottom, X±180 = edges
const V = {
  topCenter: new THREE.Vector2(0, 255),
  topLeft: new THREE.Vector2(-180, 255),
  topRight: new THREE.Vector2(180, 255),
  botCenter: new THREE.Vector2(0, -255),
  botLeft: new THREE.Vector2(-180, -255),
  botRight: new THREE.Vector2(180, -255),
  flapLeft: new THREE.Vector2(-180, 75),
  flapRight: new THREE.Vector2(180, 75),
  wingTipLeft: new THREE.Vector2(-90, -255),
  wingTipRight: new THREE.Vector2(90, -255),
};

// Classic dart airplane — 6 panels
const panels = {
  leftFlap: [V.topCenter, V.topLeft, V.flapLeft],
  rightFlap: [V.topCenter, V.topRight, V.flapRight],
  leftFuse: [V.topCenter, V.wingTipLeft, V.botCenter],
  rightFuse: [V.topCenter, V.wingTipRight, V.botCenter],
  leftWing: [V.topCenter, V.flapLeft, V.botLeft, V.wingTipLeft],
  rightWing: [V.topCenter, V.flapRight, V.botRight, V.wingTipRight],
};

// ─── Panel mesh ─────────────────────────────────────────────────
// depthBias: higher = rendered on top when coplanar
function PanelMesh({ points, texture, meshRef, depthBias = 0 }) {
  const { frontGeom, backGeom } = useMemo(() => {
    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, p.y);
      else shape.lineTo(p.x, p.y);
    });

    // Front geometry: normal UVs
    const fg = new THREE.ShapeGeometry(shape);
    const fUvs = fg.attributes.uv.array;
    const fPos = fg.attributes.position.array;
    for (let i = 0; i < fUvs.length; i += 2) {
      const vi = i / 2;
      fUvs[i] = (fPos[vi * 3] + 180) / 360;
      fUvs[i + 1] = (fPos[vi * 3 + 1] + 255) / 510;
    }
    fg.attributes.uv.needsUpdate = true;

    // Back geometry: flipped UVs (mirror X) so texture isn't reversed
    const bg = new THREE.ShapeGeometry(shape);
    const bUvs = bg.attributes.uv.array;
    const bPos = bg.attributes.position.array;
    for (let i = 0; i < bUvs.length; i += 2) {
      const vi = i / 2;
      bUvs[i] = 1 - (bPos[vi * 3] + 180) / 360; // flipped horizontally
      bUvs[i + 1] = (bPos[vi * 3 + 1] + 255) / 510;
    }
    bg.attributes.uv.needsUpdate = true;

    return { frontGeom: fg, backGeom: bg };
  }, [points]);

  return (
    <group ref={meshRef}>
      {/* Front face */}
      <mesh geometry={frontGeom} renderOrder={depthBias}>
        <meshStandardMaterial
          map={texture}
          side={THREE.FrontSide}
          roughness={0.6}
          metalness={0.05}
          color="#ffffff"
          polygonOffset
          polygonOffsetFactor={-depthBias}
          polygonOffsetUnits={-depthBias * 4}
        />
      </mesh>
      {/* Back face: same texture, UV flipped so image isn't mirrored */}
      <mesh geometry={backGeom} renderOrder={depthBias}>
        <meshStandardMaterial
          map={texture}
          side={THREE.BackSide}
          roughness={0.6}
          metalness={0.05}
          color="#ffffff"
          polygonOffset
          polygonOffsetFactor={-depthBias - 1}
          polygonOffsetUnits={-depthBias * 4 - 4}
        />
      </mesh>
    </group>
  );
}

// ─── Matrix helper: rotation around an arbitrary axis through a point ──
const foldMatrix = (origin, axisDir, angle) => {
  const o = origin;
  const t1 = new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z);
  const r = new THREE.Matrix4().makeRotationAxis(axisDir.clone().normalize(), angle);
  const t2 = new THREE.Matrix4().makeTranslation(o.x, o.y, o.z);
  return t2.multiply(r).multiply(t1);
};

// ─── Origami system ─────────────────────────────────────────────
function OrigamiSystem({ texture, targetProgress }) {
  const progressRef = useRef(0);
  const meshRefs = {
    leftFlap: useRef(), rightFlap: useRef(),
    leftFuse: useRef(), rightFuse: useRef(),
    leftWing: useRef(), rightWing: useRef(),
  };

  useFrame((_, delta) => {
    const diff = targetProgress - progressRef.current;
    if (Math.abs(diff) > 0.0005) {
      progressRef.current += diff * Math.min(delta * 1.8, 0.04);
    } else {
      progressRef.current = targetProgress;
    }

    const p = progressRef.current;
    const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Phase 1 (0–0.33): Top flaps fold 180° along their diagonals
    const pFlap = ease(Math.min(Math.max(p / 0.33, 0), 1));
    // Phase 2 (0.33–0.66): Fold in half along center line
    const pHalf = ease(Math.min(Math.max((p - 0.33) / 0.33, 0), 1));
    // Phase 3 (0.66–1.0): Wings fold outward
    const pWing = ease(Math.min(Math.max((p - 0.66) / 0.34, 0), 1));

    const flapAngle = pFlap * Math.PI;           // 180° fold
    const halfAngle = pHalf * Math.PI * 0.5;     // 90° center fold (tight)
    const wingAngle = pWing * Math.PI * 0.45;    // ~81° wing fold outward

    // ── Flap folds (along diagonal crease) ──
    const leftFlapAxis = new THREE.Vector3(-180, -180, 0);
    const mLeftFlapLocal = foldMatrix(new THREE.Vector3(0, 255, 0), leftFlapAxis, flapAngle);

    const rightFlapAxis = new THREE.Vector3(180, -180, 0);
    const mRightFlapLocal = foldMatrix(new THREE.Vector3(0, 255, 0), rightFlapAxis, -flapAngle);

    // ── Center fold (fold left side onto right) ──
    const mLeftHalf = new THREE.Matrix4().makeRotationY(halfAngle);
    const mRightHalf = new THREE.Matrix4().makeRotationY(-halfAngle);

    // ── Wing fold (fold wings outward from fuselage) ──
    const leftWingAxis = new THREE.Vector3(-90, -510, 0);
    const mLeftWingLocal = foldMatrix(new THREE.Vector3(0, 255, 0), leftWingAxis, -wingAngle);

    const rightWingAxis = new THREE.Vector3(90, -510, 0);
    const mRightWingLocal = foldMatrix(new THREE.Vector3(0, 255, 0), rightWingAxis, wingAngle);

    // ── Compose transforms (hierarchical) ──
    // Add physical z-offset per layer to prevent z-fighting
    const zOffset = (layer) => new THREE.Matrix4().makeTranslation(0, 0, layer * 0.5);

    const mLeftFlap = mLeftHalf.clone().multiply(mLeftFlapLocal).multiply(zOffset(3));
    const mRightFlap = mRightHalf.clone().multiply(mRightFlapLocal).multiply(zOffset(3));

    const mLeftFuse = mLeftHalf.clone().multiply(zOffset(0));
    const mRightFuse = mRightHalf.clone().multiply(zOffset(0));

    const mLeftWing = mLeftHalf.clone().multiply(mLeftWingLocal).multiply(zOffset(1));
    const mRightWing = mRightHalf.clone().multiply(mRightWingLocal).multiply(zOffset(1));

    // Apply to meshes
    const updates = {
      leftFlap: mLeftFlap, rightFlap: mRightFlap,
      leftFuse: mLeftFuse, rightFuse: mRightFuse,
      leftWing: mLeftWing, rightWing: mRightWing,
    };
    Object.entries(updates).forEach(([key, matrix]) => {
      const mesh = meshRefs[key].current;
      if (mesh) {
        mesh.matrix.copy(matrix);
        mesh.matrixAutoUpdate = false;
        // Hide flaps after center fold — sandwiched inside
        if (key === 'leftFlap' || key === 'rightFlap') {
          mesh.visible = pHalf < 0.85;
        }
      }
    });
  });

  // Depth bias: flaps on top (fold over body), wings middle, fuse bottom
  const DEPTH_BIAS = {
    leftFlap: 4, rightFlap: 4,
    leftWing: 2, rightWing: 2,
    leftFuse: 1, rightFuse: 1,
  };

  return (
    <group>
      {Object.keys(panels).map(key => (
        <PanelMesh
          key={key}
          points={panels[key]}
          texture={texture}
          meshRef={meshRefs[key]}
          depthBias={DEPTH_BIAS[key]}
        />
      ))}
    </group>
  );
}

// ─── Camera rig: flat 2D front → 3D angle, then release to OrbitControls ────
function CameraRig({ targetProgress }) {
  const progressRef = useRef(0);
  const doneRef = useRef(false);

  // Reset when folding restarts
  useEffect(() => {
    if (targetProgress < 0.01) {
      doneRef.current = false;
      progressRef.current = 0;
    }
  }, [targetProgress]);

  useFrame(({ camera }, delta) => {
    // Once camera reached final position, stop — let OrbitControls take over
    if (doneRef.current) return;

    const diff = targetProgress - progressRef.current;
    if (Math.abs(diff) > 0.001) {
      progressRef.current += diff * Math.min(delta * 1.5, 0.03);
    } else {
      progressRef.current = targetProgress;
    }

    const t = Math.min(progressRef.current * 1.8, 1);
    const startPos = new THREE.Vector3(0, 0, 650);
    const endPos = new THREE.Vector3(-180, -60, 480);
    camera.position.lerpVectors(startPos, endPos, t);
    camera.lookAt(0, 0, 0);

    // Release camera control when animation is done
    if (t >= 0.99) {
      doneRef.current = true;
    }
  });

  return null;
}

// ─── Fly animation: airplane flies away ─────────────────────
function FlyAnimation({ isFlying, groupRef }) {
  const flyProgress = useRef(0);

  useFrame((_, delta) => {
    if (!isFlying || !groupRef.current) return;

    flyProgress.current += delta * 0.4;
    const t = flyProgress.current;

    // Smoothstep easing
    const smooth = (x) => x * x * (3 - 2 * x);

    // Phase 1 (0–0.5): rotate to flight pose — nose pointing upper-right
    const poseT = smooth(Math.min(t / 0.5, 1));

    // Rotate from vertical (nose up) to horizontal (nose right) with ~30° upward tilt
    groupRef.current.rotation.z = -poseT * (Math.PI / 2 - 0.5); // ~60° tilt (nose upper-right)
    groupRef.current.rotation.x = -poseT * 0.2;                  // slight forward lean

    // Phase 2 (0.3+): fly to upper-right
    if (t > 0.3) {
      const flyT = t - 0.3;
      const accel = flyT * flyT;

      // Fly diagonally upper-right (like the reference image)
      groupRef.current.position.x = accel * 700;       // fly right
      groupRef.current.position.y = accel * 400;        // fly up
      groupRef.current.position.z = -accel * 100;       // slight depth

      // Shrink as it flies away
      const s = Math.max(0.75 - flyT * 0.35, 0.02);
      groupRef.current.scale.setScalar(s);
    }
  });

  return null;
}

// ─── Main component ─────────────────────────────────────────────
export default function PaperAirplaneScene({ photos, layouts, drawingLayers = {}, onClose }) {
  const [texture, setTexture] = useState(null);
  const [targetProgress, setTargetProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [letterPage, setLetterPage] = useState(0);
  const [pageAnim, setPageAnim] = useState('');
  const timersRef = useRef([]);
  const flyGroupRef = useRef(null);

  useEffect(() => { createCollageTexture(photos, layouts, drawingLayers).then(setTexture); }, [photos, layouts, drawingLayers]);

  const startFolding = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setTargetProgress(0);
    setPhase(0);
    setIsFlying(false);
    setLetterPage(0);

    const t = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)); };
    t(() => { setTargetProgress(0.36); setPhase(1); }, 800);
    t(() => { setTargetProgress(0.69); setPhase(2); }, 3800);
    t(() => { setTargetProgress(1); setPhase(3); }, 6800);
    t(() => { setPhase(4); }, 10000);
  }, []);

  useEffect(() => {
    if (texture) startFolding();
    return () => timersRef.current.forEach(clearTimeout);
  }, [texture, startFolding]);

  const handleFly = useCallback(() => {
    setIsFlying(true);
    setPhase(5);
    const t1 = setTimeout(() => setPhase(6), 2500);
    timersRef.current.push(t1);
  }, []);

  const goToPage = useCallback((dir) => {
    setPageAnim(dir > 0 ? 'letter-page-exit-left' : 'letter-page-exit-right');
    setTimeout(() => {
      setLetterPage(prev => prev + dir);
      setPageAnim(dir > 0 ? 'letter-page-enter-right' : 'letter-page-enter-left');
      setTimeout(() => setPageAnim(''), 500);
    }, 350);
  }, []);

  const LABELS = [
    '종이를 펼치고 있어요...',
    '① 윗부분 삼각형을 중심선으로 접기',
    '② 반으로 접기',
    '③ 날개를 펼치기',
    '✈ 비행기 완성!',
    '✈ 날아가는 중...',
  ];

  const LETTER_PAGES = [
    // ── 페이지 1: 인사 + 엄마 ──
    {
      dear: '언니, 엄마, 아빠 안녕!',
      headerPhoto: '/KakaoTalk_Photo_2026-04-27-21-14-17 020.jpeg',
      body: (
        <>
          나 두부야.<br /><br />
          갑자기 이렇게 인사해서 놀랐지. 나도 조금 놀랐어. 사실 근데 나 너무 아프거나 힘들어서 간 건 아니니까 너무 걱정 안 했으면 좋겠어.<br /><br />
          엄마, 나 마지막까지 엄마 옆에 있으면서 엄마한테 뭐라도 묻히기 싫어서 계속 움직였던 거 기억나? 나 원래 깔끔한 거 좋아하잖아. 엄마 불편하게 하는 거 싫어서 그런 거야. 엄마는 그거 보고 또 마음 아파할까봐 말해주는 거야.
        </>
      ),
      sign: null,
    },
    // ── 페이지 2: 아빠 + 언니 ──
    {
      dear: null,
      body: (
        <>
          아빠, 아빠 집 오면 내가 제일 먼저 달려갔던 거 알지. 배 까고 난리쳤던 거 나 그때 진짜 신나서 그런 거야. 아빠 오는 소리만 들어도 기분 좋아서 기다리고 있었어.<br /><br />
          언니, 나 언니 방 앞에서 맨날 기다리던 거 기억하지. 문 열리면 바로 들어가서 언니 베개 차지하고 눕고, 언니 일어나면 뽀뽀해주고 나 그 시간 되게 좋아했어. 언니 냄새도 좋고 따뜻해서.
        </>
      ),
      sign: null,
    },
    // ── 페이지 3: 여행 + 시장 + 고구마 ──
    {
      dear: null,
      body: (
        <>
          그리고 나 여행도 많이 다녀서 좋았어. 하와이도, 뉴욕도 나 사실 많이 걷는 건 별로였는데 유모차 타고 다니는 건 좋았어. 편하고 구경하는 거 재밌었거든.<br /><br />
          엄마랑 시장 다닐 때도 기억나. 사람들이 나 예쁘다고 하면 나 일부러 더 눈 크게 뜨고 가만히 쳐다봤잖아. 나 그거 좋아했어. 사람들이 좋아해주는 거.<br /><br />
          그리고 나 고구마도 너무 좋았어. 그거 먹을 때 제일 행복했어.
        </>
      ),
      sign: null,
    },
    // ── 페이지 4: 소소한 일상 + 대전 ──
    {
      dear: null,
      body: (
        <>
          언니 남자친구는 나 아직 조금 어색하긴 했는데 그래도 나쁘지 않았어. 언니 좋아하는 사람이니까 나도 좋게 보려고 했어.<br /><br />
          나 택배 오면 제일 먼저 나가던 거 그것도 그냥 궁금해서 그런 거야. 우리 집에 뭐 오는지 내가 먼저 확인해야 될 거 같아서.<br /><br />
          나 다른 강아지들은 별로 안 좋아했지만 가끔 큰 애들은 괜찮았던 거 알지. 나 나름 취향 있었어.<br /><br />
          그리고 나 어디서 태어나서 어디로 왔다가 다시 어디로 가는지 솔직히 잘 모르겠어. 근데 한 가지는 알아. 대전에서 처음 가족 만나고 대전에서 마지막까지 있었던 거. 그거 나한테는 그냥 처음이랑 끝이 다 가족이었다는 느낌이라서 좋아.
        </>
      ),
      sign: null,
    },
    // ── 페이지 5: 마무리 ──
    {
      dear: null,
      body: (
        <>
          언니, 엄마, 아빠! 나 진짜 오래 살았지? 원래 아픈 애였는데 이렇게 오래 살 수 있었던 거 다 가족 덕분인 거 알아. 그래서 나 미안한 거 없어. 아쉬운 건 조금 있지만 슬픈 건 아니야.<br /><br />
          근데 나 완전히 없어지는 거 아니야. 그냥 예전처럼 만질 수만 없는 거지. 우리 가족이 나 생각하면 나 그때 다 느껴.<br /><br />
          그러니까 너무 자책하지 말고 그냥 가끔 내 생각나면 웃으면서 한 번 불러줘.<br /><br />
          나 두부니까 이쁜 애답게 잘 지내고 있을게. 사랑해 진짜로. ❤️
        </>
      ),
      sign: 'withPhoto',
    },
  ];

  const currentPage = LETTER_PAGES[letterPage];
  const totalPages = LETTER_PAGES.length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 28, right: 32, zIndex: 1050, background: 'rgba(255,255,255,0.95)', border: 'none', padding: '10px 22px', borderRadius: 24, cursor: 'pointer', fontFamily: 'Gowun Dodum,sans-serif', fontSize: '0.95rem', color: '#333', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>닫기</button>
      <div style={{ position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 1010, fontFamily: 'Gowun Dodum,sans-serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 8px rgba(0,0,0,0.5)', textAlign: 'center' }}>{LABELS[phase]}</div>

      <Canvas style={{ flex: 1 }} gl={{ antialias: true, logarithmicDepthBuffer: true }} dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 650]} />
        <CameraRig targetProgress={targetProgress} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[150, 200, 300]} intensity={1.4} />
        <directionalLight position={[-100, -50, -150]} intensity={0.4} />
        <Environment preset="city" />
        <group ref={flyGroupRef} scale={0.75}>
          {texture && <OrigamiSystem texture={texture} targetProgress={targetProgress} />}
        </group>
        <FlyAnimation isFlying={isFlying} groupRef={flyGroupRef} />
      </Canvas>

      {/* 비행기 날리기 버튼 */}
      {phase === 4 && !isFlying && (
        <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1010, animation: 'fadeInLove 0.6s ease-out' }}>
          <button
            onClick={handleFly}
            className="nav-text-btn"
            style={{ background: 'rgba(255,255,255,0.95)', color: '#555' }}
          >
            ✈ 비행기 날리기
          </button>
        </div>
      )}

      {/* 편지 메시지 — 3페이지 페이지네이션 */}
      {phase === 6 && (
        <div className="love-message-container">
          <div className="letter-scroll-area">
            <div className={`letter-paper ${pageAnim}`} key={`letter-page-${letterPage}`}>
              <div className="letter-lines">
                {Array.from({ length: 14 }, (_, i) => (
                  <div key={i} className="letter-line" />
                ))}
              </div>
              <div className="letter-content">
                {currentPage.dear && (
                  <p className="letter-dear">{currentPage.dear}</p>
                )}
                {currentPage.headerPhoto && (
                  <div className="letter-header-photo-area">
                    <img
                      className="letter-tofu-photo"
                      src={currentPage.headerPhoto}
                      alt="두부"
                    />
                  </div>
                )}
                <p className="letter-body">{currentPage.body}</p>
                {currentPage.sign === 'withPhoto' && (
                  <div className="letter-sign-area">
                    <img
                      className="letter-tofu-photo"
                      src="/KakaoTalk_Photo_2026-04-27-21-14-15 013.jpeg"
                      alt="두부"
                    />
                    <p className="letter-sign">— 두부 🐾</p>
                  </div>
                )}
              </div>


            </div>
          </div>

          {/* 이전 / 다음 버튼 */}
          <div className="letter-nav">
            {letterPage > 0 && (
              <button className="letter-nav-btn letter-nav-prev" onClick={() => goToPage(-1)}>
                ← 이전
              </button>
            )}
            {letterPage < totalPages - 1 && (
              <button className="letter-nav-btn letter-nav-next" onClick={() => goToPage(1)}>
                다음 →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
