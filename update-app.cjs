const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Title is already updated
// 2. States: replace `isEraser` with `activeTool` and add `textInputData`
content = content.replace(
  `const [isEraser, setIsEraser] = useState(false);`,
  `const [activeTool, setActiveTool] = useState('draw'); // draw, erase, text
  const [textInputData, setTextInputData] = useState(null);`
);

// 3. getCanvasPoint and setupDrawingCanvas
content = content.replace(
  /const setupDrawingCanvas = useCallback\(\(\) => \{[\s\S]*?ctx\.drawImage\(image, 0, 0, rect\.width, rect\.height\);\s*\}\s*image\.src = savedLayer;\s*\}\s*\}, \[expandedIndex, drawingLayers\]\);/,
  `const setupDrawingCanvas = useCallback(() => {
    if (expandedIndex === null || !canvasRef.current || !imageStageRef.current) return;

    const canvas = canvasRef.current;
    const stage = imageStageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = stage.offsetWidth;
    const height = stage.offsetHeight;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = \`\${width}px\`;
    canvas.style.height = \`\${height}px\`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const savedLayer = drawingLayers[expandedIndex];
    if (savedLayer) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, width, height);
      };
      image.src = savedLayer;
    }
  }, [expandedIndex, drawingLayers]);`
);

content = content.replace(
  /const getCanvasPoint = useCallback\(\(event\) => \{[\s\S]*?y: event\.clientY - rect\.top,\s*\};\s*\}, \[\]\);/,
  `const getCanvasPoint = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }, []);`
);

// 4. handling drawing
content = content.replace(
  /const handleStartDrawing = useCallback\(\(event\) => \{[\s\S]*?lastPointRef\.current = point;\s*\}, \[drawColor, drawSize, isEraser, getCanvasPoint\]\);/,
  `const handleTextSubmit = useCallback((text, pos) => {
    if (!text.trim() || !canvasRef.current) {
      setTextInputData(null);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = \`\${Math.max(16, drawSize * 4)}px "Gowun Dodum", sans-serif\`;
    ctx.fillStyle = drawColor;
    ctx.textBaseline = 'top';
    const lines = text.split('\\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, pos.x, pos.y + i * (Math.max(16, drawSize * 4) * 1.2));
    });
    
    saveCurrentLayer();
    setTextInputData(null);
  }, [drawColor, drawSize, saveCurrentLayer]);

  const handleStartDrawing = useCallback((event) => {
    if (!canvasRef.current) return;
    if (event.target.tagName.toLowerCase() === 'textarea') return;

    const point = getCanvasPoint(event);

    if (activeTool === 'text') {
      if (textInputData) {
        handleTextSubmit(textInputData.text, textInputData.pos);
      } else {
        setTextInputData({ pos: point, text: '' });
      }
      return;
    }

    if (textInputData) {
       handleTextSubmit(textInputData.text, textInputData.pos);
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
  }, [drawColor, drawSize, activeTool, getCanvasPoint, textInputData, handleTextSubmit]);`
);

// 5. stop using isEraser in toolbars
content = content.replace(
  `disabled={isEraser}`,
  `disabled={activeTool === 'erase'}`
);

content = content.replace(
  /<button\s*className="draw-btn"\s*type="button"\s*onClick=\{\(\) => setIsEraser\(\(prev\) => !prev\)\}\s*>\s*\{isEraser \? '펜 모드' : '지우개'\}\s*<\/button>/g,
  `<button
                    className={\`draw-btn \${activeTool === 'draw' ? 'active' : ''}\`}
                    type="button"
                    onClick={() => setActiveTool('draw')}
                  >
                    펜
                  </button>
                  <button
                    className={\`draw-btn \${activeTool === 'text' ? 'active' : ''}\`}
                    type="button"
                    onClick={() => setActiveTool('text')}
                  >
                    텍스트
                  </button>
                  <button
                    className={\`draw-btn \${activeTool === 'erase' ? 'active' : ''}\`}
                    type="button"
                    onClick={() => setActiveTool('erase')}
                  >
                    지우개
                  </button>`
);

// 6. render text input overlay
content = content.replace(
  /<canvas\s*ref=\{canvasRef\}\s*className="lightbox-draw-canvas"[\s\S]*?onPointerCancel=\{handleStopDrawing\}\s*\/>/g,
  `<canvas
                    ref={canvasRef}
                    className="lightbox-draw-canvas"
                    onPointerDown={handleStartDrawing}
                    onPointerMove={handleDrawingMove}
                    onPointerUp={handleStopDrawing}
                    onPointerLeave={handleStopDrawing}
                    onPointerCancel={handleStopDrawing}
                  />
                  {textInputData && (
                    <textarea
                      autoFocus
                      className="text-draw-input"
                      style={{
                        position: 'absolute',
                        left: textInputData.pos.x,
                        top: textInputData.pos.y,
                        color: drawColor,
                        fontSize: \`\${Math.max(16, drawSize * 4)}px\`,
                        fontFamily: '"Gowun Dodum", sans-serif',
                        background: 'transparent',
                        border: '1px dashed #ccc',
                        outline: 'none',
                        resize: 'none',
                        lineHeight: '1.2',
                        minWidth: '100px',
                        minHeight: '30px',
                        overflow: 'hidden',
                        zIndex: 10,
                      }}
                      value={textInputData.text}
                      onChange={(e) => setTextInputData({ ...textInputData, text: e.target.value })}
                      onBlur={() => handleTextSubmit(textInputData.text, textInputData.pos)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setTextInputData(null);
                        }
                      }}
                    />
                  )}`
);

fs.writeFileSync('src/App.jsx', content);

