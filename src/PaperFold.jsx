import React, { useRef, useEffect, useState, useMemo } from 'react';
import './PaperFold.css';

/**
 * PaperFold – CSS-only paper airplane folding animation
 *
 * Strategy:
 *  - We create a canvas texture of the collage (same as before)
 *  - We split it into 6 triangular / quad panels matching the fold lines
 *  - Each panel is a <div> with the collage as background + clip-path
 *  - CSS transforms (rotateY, rotateX) with transform-origin at the fold edge
 *    simulate the paper folding step by step
 *  - A progress variable (0→1) drives the 4-stage fold sequence
 */

// ─── Collage texture via <canvas> ───────────────────────────────
function createCollageImage(photos, layouts) {
  const W = 360;
  const H = 510;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2; // 2x for sharpness
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  const scale = 2;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  return new Promise((resolve) => {
    let loaded = 0;
    const images = [];
    const cellW = W / 2;
    const cellH = H / 5;

    const drawAndResolve = () => {
      photos.forEach((_, idx) => {
        if (!images[idx]) return;
        const pos = layouts[idx];
        const x = pos.cCol * cellW;
        const y = pos.cRow * cellH;

        const imgAspect = images[idx].width / images[idx].height;
        const cAspect = cellW / cellH;
        let drawW = cellW, drawH = cellH, offsetX = 0, offsetY = 0;

        if (imgAspect > cAspect) {
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
        ctx.restore();
      });

      // Draw fold lines
      ctx.strokeStyle = 'rgba(200, 60, 60, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);          // center vertical
      ctx.moveTo(0, 0); ctx.lineTo(W / 2, W / 2);           // top-left diagonal
      ctx.moveTo(W, 0); ctx.lineTo(W / 2, W / 2);           // top-right diagonal
      ctx.moveTo(W / 2, 0); ctx.lineTo(50, 250);            // left wing fold
      ctx.moveTo(W / 2, 0); ctx.lineTo(310, 250);           // right wing fold
      ctx.moveTo(W / 2, 0); ctx.lineTo(90, H);              // left fuselage
      ctx.moveTo(W / 2, 0); ctx.lineTo(270, H);             // right fuselage
      ctx.stroke();

      resolve(canvas.toDataURL('image/png'));
    };

    photos.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        images[i] = img;
        loaded++;
        if (loaded === photos.length) drawAndResolve();
      };
      img.onerror = () => {
        loaded++;
        if (loaded === photos.length) drawAndResolve();
      };
    });
  });
}

// ─── Panel definitions (in the 360×510 space) ──────────────────
// clip-path polygon coords as percentages of the 360×510 container
const toPercent = (x, y) => `${(x / 360) * 100}% ${(y / 510) * 100}%`;

const PANELS = {
  // Step 1: Top flaps fold down along the diagonal lines
  leftFlap: {
    clipPath: `polygon(${toPercent(0, 0)}, ${toPercent(180, 0)}, ${toPercent(180, 180)})`,
    originX: '100%',   // fold edge is the center-vertical
    originY: '0%',
    foldAxis: 'Y',     // rotateY to fold inward
    step: 0,           // fold at step 0→1
    maxAngle: -180,
    zBoost: 10,
  },
  rightFlap: {
    clipPath: `polygon(${toPercent(180, 0)}, ${toPercent(360, 0)}, ${toPercent(180, 180)})`,
    originX: '0%',
    originY: '0%',
    foldAxis: 'Y',
    step: 0,
    maxAngle: 180,
    zBoost: 10,
  },

  // Step 2: Inner triangles fold along the nose-to-wing-tip lines
  leftInner: {
    clipPath: `polygon(${toPercent(180, 0)}, ${toPercent(180, 180)}, ${toPercent(90, 510)}, ${toPercent(180, 510)})`,
    originX: '100%',
    originY: '0%',
    foldAxis: 'Y',
    step: 1,
    maxAngle: -170,
    zBoost: 20,
  },
  rightInner: {
    clipPath: `polygon(${toPercent(180, 0)}, ${toPercent(180, 180)}, ${toPercent(270, 510)}, ${toPercent(180, 510)})`,
    originX: '0%',
    originY: '0%',
    foldAxis: 'Y',
    step: 1,
    maxAngle: 170,
    zBoost: 20,
  },

  // Step 3: Wings fold up
  leftWing: {
    clipPath: `polygon(${toPercent(180, 0)}, ${toPercent(0, 0)}, ${toPercent(0, 510)}, ${toPercent(90, 510)}, ${toPercent(180, 180)})`,
    originX: '100%',
    originY: '0%',
    foldAxis: 'Y',
    step: 2,
    maxAngle: -170,
    zBoost: 5,
  },
  rightWing: {
    clipPath: `polygon(${toPercent(180, 0)}, ${toPercent(360, 0)}, ${toPercent(360, 510)}, ${toPercent(270, 510)}, ${toPercent(180, 180)})`,
    originX: '0%',
    originY: '0%',
    foldAxis: 'Y',
    step: 2,
    maxAngle: 170,
    zBoost: 5,
  },
};

const STEP_LABELS = [
  '① 상단 삼각형을 중심선으로 접기',
  '② 안쪽 면을 중심선으로 접기',
  '③ 날개를 위로 접기',
  '✈ 완성!'
];

// ─── Component ──────────────────────────────────────────────────
export default function PaperFoldScene({ photos, layouts, onClose }) {
  const [bgImage, setBgImage] = useState(null);
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not started
  const [folded, setFolded] = useState([false, false, false]); // which steps are folded

  useEffect(() => {
    createCollageImage(photos, layouts).then(setBgImage);
  }, [photos, layouts]);

  // Auto-start fold sequence
  useEffect(() => {
    if (!bgImage) return;
    const timer = setTimeout(() => setCurrentStep(0), 600);
    return () => clearTimeout(timer);
  }, [bgImage]);

  // Auto-advance steps
  useEffect(() => {
    if (currentStep < 0 || currentStep > 2) return;

    const timer = setTimeout(() => {
      setFolded(prev => {
        const next = [...prev];
        next[currentStep] = true;
        return next;
      });

      // Move to next step after fold completes
      const nextTimer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 900);

      return () => clearTimeout(nextTimer);
    }, 400);

    return () => clearTimeout(timer);
  }, [currentStep]);

  const stepLabel = currentStep >= 0 && currentStep <= 3
    ? STEP_LABELS[Math.min(currentStep, 3)]
    : '준비 중...';

  return (
    <div className="paper-fold-overlay">
      <button className="paper-fold-close" onClick={onClose}>
        닫기
      </button>

      <div className="paper-fold-status">
        {stepLabel}
      </div>

      <div className="paper-fold-scene">
        <div className="paper-fold-container">
          {bgImage && Object.entries(PANELS).map(([key, panel]) => {
            const isFolded = folded[panel.step];
            const angle = isFolded ? panel.maxAngle : 0;

            return (
              <div
                key={key}
                className={`paper-fold-panel ${isFolded ? 'folded' : ''}`}
                style={{
                  clipPath: panel.clipPath,
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: '100% 100%',
                  transformOrigin: `${panel.originX} ${panel.originY}`,
                  transform: `perspective(800px) rotate${panel.foldAxis}(${angle}deg)`,
                  zIndex: isFolded ? panel.zBoost : 1,
                  transitionDelay: isFolded ? '0ms' : '0ms',
                }}
              />
            );
          })}

          {/* Center-line reference (always visible) */}
          <div className="paper-fold-center-line" />
        </div>
      </div>

      <div className="paper-fold-controls">
        <button
          className="paper-fold-btn"
          onClick={() => {
            setFolded([false, false, false]);
            setCurrentStep(-1);
            setTimeout(() => setCurrentStep(0), 400);
          }}
        >
          다시 접기
        </button>
      </div>
    </div>
  );
}
