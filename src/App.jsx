import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import PaperAirplaneScene from './PaperAirplane';

const DEFAULT_PHOTOS = [
  '/KakaoTalk_Photo_2026-04-27-21-14-19 030.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-18 029.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-18 028.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-18 027.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-18 026.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-18 025.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-18 024.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-17 023.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-17 022.jpeg',
  '/KakaoTalk_Photo_2026-04-27-21-14-17 021.jpeg',
];

const photoLayouts = [
  { sx: 4, sy: 4, sR: -12, sS: 1, sZ: 1, cCol: 0, cRow: 0, tR: -3 },
  { sx: 23, sy: 12, sR: 5, sS: 1.05, sZ: 3, cCol: 1, cRow: 0, tR: 2 },
  { sx: 43, sy: 3, sR: -3, sS: 1, sZ: 1, cCol: 0, cRow: 1, tR: -5 },
  { sx: 63, sy: 10, sR: 8, sS: 1.02, sZ: 3, cCol: 1, cRow: 1, tR: 4 },
  { sx: 81, sy: 5, sR: -6, sS: 1, sZ: 1, cCol: 0, cRow: 2, tR: -2 },
  { sx: 3, sy: 52, sR: 7, sS: 1.03, sZ: 3, cCol: 1, cRow: 2, tR: 5 },
  { sx: 21, sy: 62, sR: -8, sS: 1, sZ: 1, cCol: 0, cRow: 3, tR: -4 },
  { sx: 41, sy: 50, sR: 4, sS: 1.04, sZ: 3, cCol: 1, cRow: 3, tR: 1 },
  { sx: 61, sy: 60, sR: -10, sS: 1, sZ: 1, cCol: 0, cRow: 4, tR: -6 },
  { sx: 79, sy: 55, sR: 6, sS: 1.02, sZ: 3, cCol: 1, cRow: 4, tR: 3 },
];

export default function App() {
  const [step, setStep] = useState(-1); // -1 = 업로드, 0 = 흩뿌려짐, 1 = 콜라주, 2 = 3D 비행기 접기
  const [photos, setPhotos] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const [drawColor, setDrawColor] = useState('#ff3b30');
  const [drawSize, setDrawSize] = useState(4);
  const [activeTool, setActiveTool] = useState("draw");
  const [selectedEmoji, setSelectedEmoji] = useState('❤️');
  const [drawingLayers, setDrawingLayers] = useState({});
  const [lightboxReady, setLightboxReady] = useState(false);

  const EMOJI_LIST = ['❤️', '🌸', '⭐', '🎀', '🐾', '🌟', '😊', '🥰', '✨', '🫶', '🌈', '🍀', '🐶', '🌺', '🎵', '💕', '🦋', '🍓', '🌙', '🔥'];

  const canvasRef = useRef(null);
  const imageStageRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  // ─── Background Music ─────────────────────────────────────────
  const audioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    const audio = new Audio('/YTDown_YouTube_Stephen-Sanchez-Until-I-Found-You-Offici_Media_GxldQ9eX2wo_009_128k.mp3');
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;

    // Try autoplay; if blocked by browser, play on first user interaction
    const tryPlay = () => {
      audio.play().then(() => {
        setIsPlaying(true);
        document.removeEventListener('click', tryPlay);
        document.removeEventListener('touchstart', tryPlay);
      }).catch(() => { });
    };

    tryPlay();
    document.addEventListener('click', tryPlay, { once: false });
    document.addEventListener('touchstart', tryPlay, { once: false });

    return () => {
      audio.pause();
      audio.src = '';
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('touchstart', tryPlay);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => { });
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v === 0) setIsMuted(true);
    else setIsMuted(false);
  }, []);

  const handlePolaroidClick = useCallback((globalIdx) => {
    if (step === 0) {
      setLightboxReady(false);
      setExpandedIndex(globalIdx);
    }
  }, [step]);

  const handleCloseExpanded = useCallback(() => {
    setExpandedIndex(null);
  }, []);

  const setupDrawingCanvas = useCallback(() => {
    if (expandedIndex === null || !canvasRef.current || !imageStageRef.current) return;

    const canvas = canvasRef.current;
    const stage = imageStageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const newW = Math.floor(rect.width * dpr);
    const newH = Math.floor(rect.height * dpr);

    // Only resize if dimensions actually changed
    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const savedLayer = drawingLayers[expandedIndex];
    if (savedLayer) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = savedLayer;
    }
  }, [expandedIndex, drawingLayers]);

  // Only setup canvas after lightbox spring animation completes
  useEffect(() => {
    if (lightboxReady && expandedIndex !== null) {
      setupDrawingCanvas();
    }
  }, [lightboxReady, expandedIndex, setupDrawingCanvas]);

  useEffect(() => {
    if (expandedIndex === null) return undefined;

    const handleResize = () => setupDrawingCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [expandedIndex, setupDrawingCanvas]);

  const getCanvasPoint = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const saveCurrentLayer = useCallback(() => {
    if (expandedIndex === null || !canvasRef.current) return;

    const dataUrl = canvasRef.current.toDataURL('image/png');
    setDrawingLayers((prev) => ({
      ...prev,
      [expandedIndex]: dataUrl,
    }));
  }, [expandedIndex]);

  const handleEmojiStamp = useCallback((event) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getCanvasPoint(event);
    const emojiSize = Math.max(20, drawSize * 8);
    ctx.font = `${emojiSize}px serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(selectedEmoji, point.x, point.y);
    saveCurrentLayer();
  }, [selectedEmoji, drawSize, getCanvasPoint, saveCurrentLayer]);

  const handleStartDrawing = useCallback((event) => {
    if (!canvasRef.current) return;
    if (event.target.tagName.toLowerCase() === 'textarea') return;

    const point = getCanvasPoint(event);

    if (activeTool === 'emoji') {
      handleEmojiStamp(event);
      return;
    }

    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawSize;
    ctx.globalCompositeOperation = activeTool === 'erase' ? 'destination-out' : 'source-over';

    isDrawingRef.current = true;
    lastPointRef.current = point;
  }, [drawColor, drawSize, activeTool, getCanvasPoint, handleEmojiStamp]);

  const handleDrawingMove = useCallback((event) => {
    if (!isDrawingRef.current || !canvasRef.current) return;

    event.preventDefault();
    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPointRef.current = point;
  }, [getCanvasPoint]);

  const handleStopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    saveCurrentLayer();
  }, [saveCurrentLayer]);

  const handleClearDrawing = useCallback(() => {
    if (!canvasRef.current || expandedIndex === null) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    setDrawingLayers((prev) => {
      const next = { ...prev };
      delete next[expandedIndex];
      return next;
    });
  }, [expandedIndex]);

  // ─── Upload handler ───
  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    const urls = files.map(f => URL.createObjectURL(f));
    setPhotos(prev => {
      const next = [...prev, ...urls].slice(0, 10);
      return next;
    });
  }, []);

  const handleRemovePhoto = useCallback((idx) => {
    setPhotos(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx]);
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (photos.length === 10) setStep(0);
  }, [photos]);

  return (
    <div className="app">

      {/* ─── Upload Page ─── */}
      {step === -1 && (
        <div className="upload-page">
          <div className="upload-container">
            <h1 className="upload-title">✈</h1>
            <p className="upload-subtitle">사진 10장을 선택해주세요</p>
            <p className="upload-count">{photos.length} / 10</p>

            <label className="upload-btn">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              📷 사진 선택
            </label>

            {photos.length > 0 && (
              <div className="upload-preview-grid">
                {photos.map((src, i) => (
                  <div key={i} className="upload-preview-item">
                    <img src={src} alt={`Photo ${i + 1}`} />
                    <button className="upload-remove-btn" onClick={() => handleRemovePhoto(i)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 10 && (
              <button className="upload-start-btn" onClick={handleStart}>
                시작하기 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Main App (existing) ─── */}
      {step >= 0 && (<>
      <header className="header">


        <h1 className="header-title">✈</h1>


      </header>

      <main className={`gallery ${step === 1 ? 'collage-mode' : ''}`}>

        <div className={`scatter-area ${step === 1 ? 'collage-mode' : ''}`}>

          {photos.map((src, i) => {
            const pos = photoLayouts[i];

            const targetX = step === 0 ? `${pos.sx}%` : '50%';
            const targetY = step === 0 ? `${pos.sy}%` : '50%';
            const animX = step === 0 ? 0 : (pos.cCol === 0 ? -90 : 90);
            const animY = step === 0 ? 0 : (-204 + pos.cRow * 102);

            const rotate = step === 0 ? pos.sR : 0;
            const scale = step === 0 ? pos.sS : 1;
            const zIndex = step === 0 ? pos.sZ : 15;

            return (
              <motion.div
                className={`polaroid ${step === 1 ? 'collage-mode' : ''}`}
                key={i}
                initial={false}
                animate={{
                  left: targetX,
                  top: targetY,
                  x: animX,
                  y: animY,
                  rotate: rotate,
                  scale: scale,
                  zIndex: zIndex,
                  opacity: step === 2 ? 0 : 1
                }}
                transition={
                  step === 2
                    ? { type: 'tween', duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
                    : { type: 'tween', duration: 0 }
                }
                onClick={() => handlePolaroidClick(i)}
              >
                <div className="polaroid-card">
                  <div className="tape" style={{ transform: `translateX(-50%) rotate(${pos.tR}deg)` }} />
                  <div className="polaroid-img-wrapper">
                    <img
                      src={src}
                      alt={`Dubu ${i + 1}`}
                      className="polaroid-img"
                      loading="lazy"
                    />
                    {drawingLayers[i] && (
                      <img
                        src={drawingLayers[i]}
                        alt=""
                        aria-hidden="true"
                        className="polaroid-drawing-overlay"
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {step === 1 && (
            <div className="a4-fold-lines">
              <svg viewBox="0 0 360 510" className="fold-svg">
                {/* White shadow layer */}
                <g stroke="rgba(255,255,255,0.7)" strokeWidth="3.5" strokeDasharray="10 8" fill="none">
                  {/* ① Top flap folds: top-center → left/right edges at y≈180 */}
                  <path d="M 180 0 L 0 180" />
                  <path d="M 180 0 L 360 180" />
                  {/* ② Center fold: vertical center line */}
                  <path d="M 180 0 L 180 510" />
                  {/* ③ Wing folds: top-center → wing tips at bottom */}
                  <path d="M 180 0 L 90 510" />
                  <path d="M 180 0 L 270 510" />
                </g>
                {/* Dark line layer */}
                <g stroke="rgba(0,0,0,0.6)" strokeWidth="1.8" strokeDasharray="10 8" fill="none">
                  <path d="M 180 0 L 0 180" />
                  <path d="M 180 0 L 360 180" />
                  <path d="M 180 0 L 180 510" />
                  <path d="M 180 0 L 90 510" />
                  <path d="M 180 0 L 270 510" />
                </g>
                {/* Step number labels */}
                <g fill="rgba(0,0,0,0.75)" fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                  <text x="70" y="75">①</text>
                  <text x="290" y="75">①</text>
                  <text x="195" y="360">②</text>
                  <text x="125" y="400">③</text>
                  <text x="235" y="400">③</text>
                </g>
              </svg>
            </div>
          )}

        </div>

      </main>

      <AnimatePresence>
        {step === 2 && (
          <PaperAirplaneScene
            photos={photos}
            layouts={photoLayouts}
            drawingLayers={drawingLayers}
            onClose={() => setStep(1)}
          />
        )}
      </AnimatePresence>

      <footer className="pagination">
        {step === 0 ? (
          <button className="nav-text-btn" onClick={() => setStep(1)}>
            종이 비행기 접기
          </button>
        ) : step === 1 ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="nav-text-btn" onClick={() => setStep(0)}>
              돌아가기
            </button>
            <button className="nav-text-btn" onClick={() => window.print()}>
              인쇄
            </button>
            <button className="nav-text-btn" onClick={() => setStep(2)}>
              비행기 접기
            </button>
          </div>
        ) : null}
      </footer>

      <AnimatePresence>
        {expandedIndex !== null && (
          <motion.div
            className="lightbox-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleCloseExpanded}
          >
            <motion.div
              className="lightbox-polaroid"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              onAnimationComplete={() => setLightboxReady(true)}
            >
              <div className="lightbox-card">
                <div className="draw-toolbar">
                  <label className="draw-control">
                    색상
                    <input
                      type="color"
                      value={drawColor}
                      onChange={(e) => setDrawColor(e.target.value)}
                      disabled={activeTool === 'erase'}
                    />
                  </label>
                  <label className="draw-control">
                    굵기
                    <input
                      type="range"
                      min="2"
                      max="18"
                      value={drawSize}
                      onChange={(e) => setDrawSize(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className={`draw-btn ${activeTool === 'draw' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveTool('draw')}
                  >
                    펜
                  </button>
                  <button
                    className={`draw-btn ${activeTool === 'emoji' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveTool('emoji')}
                  >
                    스티커
                  </button>
                  <button
                    className={`draw-btn ${activeTool === 'erase' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveTool('erase')}
                  >
                    지우개
                  </button>
                  <button
                    className="draw-btn"
                    type="button"
                    onClick={handleClearDrawing}
                  >
                    초기화
                  </button>
                </div>
                {activeTool === 'emoji' && (
                  <div className="emoji-picker">
                    {EMOJI_LIST.map((em) => (
                      <button
                        key={em}
                        className={`emoji-btn ${selectedEmoji === em ? 'active' : ''}`}
                        type="button"
                        onClick={() => setSelectedEmoji(em)}
                      >
                        {em}
                      </button>
                    ))}
                    <label className="emoji-size-control">
                      📐
                      <input
                        type="range"
                        min="2"
                        max="18"
                        value={drawSize}
                        onChange={(e) => setDrawSize(Number(e.target.value))}
                      />
                    </label>
                  </div>
                )}

                <div className="lightbox-image-stage" ref={imageStageRef}>
                  <img
                    src={photos[expandedIndex]}
                    alt={`Dubu ${expandedIndex + 1}`}
                    className="lightbox-img"
                    onLoad={() => { if (lightboxReady) setupDrawingCanvas(); }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="lightbox-draw-canvas"
                    onPointerDown={handleStartDrawing}
                    onPointerMove={handleDrawingMove}
                    onPointerUp={handleStopDrawing}
                    onPointerLeave={handleStopDrawing}
                    onPointerCancel={handleStopDrawing}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>)}
      {/* ─── Music Player ─── */}
      <div className="music-player">
        <button
          className="music-btn"
          onClick={togglePlay}
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? '♫' : '♪'}
        </button>
        <button
          className="music-btn volume-btn"
          onClick={() => { setIsMuted(!isMuted); }}
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
        </button>
        <div
          className="volume-slider-wrap"
          onMouseEnter={() => setShowVolume(true)}
          onMouseLeave={() => setShowVolume(false)}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>
      </div>

    </div>
  );
}
