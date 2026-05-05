const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = fs.readdirSync(publicDir).filter(f => f.startsWith('KakaoTalk') && f.endsWith('.jpeg'));
files.sort();

const photosArray = files.map((f, i) => {
  const rotation = (Math.random() * 16 - 8).toFixed(1);
  return `  { src: '/${f}', rotation: ${rotation} }`;
}).join(',\n');

const appContent = `import React, { useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import './App.css';

const photos = [
${photosArray}
];

export default function App() {
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef(null);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
      setIsMuted(!isMuted);
    }
  };

  // 30 photos into 5 rows of 6 photos
  const rows = [];
  for (let i = 0; i < photos.length; i += 6) {
    rows.push(photos.slice(i, i + 6));
  }

  return (
    <div className="app-container">
      <audio 
        ref={audioRef} 
        loop 
        src="https://cdn.pixabay.com/download/audio/2022/05/16/audio_274f826dc6.mp3?filename=calm-piano-music-111166.mp3" 
      />

      <div className="wall-frame">
        {rows.map((row, rowIndex) => (
          <div className="photo-row" key={rowIndex}>
            {/* The string that holds the photos */}
            <div className="string">
              <div className="string-knob left"></div>
              <div className="string-knob right"></div>
            </div>
            
            <div className="polaroids-container">
              {row.map((photo, index) => {
                // 약간의 상하 지그재그 배치
                const topOffset = (index % 2 === 0 ? 5 : -10) + (Math.random() * 10 - 5);
                
                return (
                  <div 
                    className="polaroid-wrapper" 
                    key={index}
                    style={{ 
                      transform: \`rotate(\${photo.rotation}deg) translateY(\${topOffset}px)\`,
                      zIndex: Math.floor(Math.random() * 10)
                    }}
                  >
                    <div className="clothespin"></div>
                    <div className="polaroid">
                      <img src={photo.src} alt={\`Dubu \${index}\`} className="polaroid-img" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={toggleAudio} className="audio-control" title={isMuted ? "음악 재생" : "음악 정지"}>
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
    </div>
  );
}
`;

fs.writeFileSync(path.join(__dirname, 'src/App.jsx'), appContent);
console.log('App.jsx rewritten for clothesline photo wall.');
