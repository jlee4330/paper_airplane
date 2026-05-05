const fs = require('fs');
const code = fs.readFileSync('src/App.jsx', 'utf8');

const newLayouts = `const scatterLayouts = [
  // Page 1
  [
    { x: 5,  y: 4,  rotate: -12, scale: 1,    z: 1 },
    { x: 22, y: 12, rotate: 5,   scale: 1.05, z: 3 },
    { x: 42, y: 3,  rotate: -3,  scale: 1,    z: 1 },
    { x: 62, y: 10, rotate: 8,   scale: 1.02, z: 3 },
    { x: 78, y: 5,  rotate: -6,  scale: 1,    z: 1 },
    { x: 4,  y: 52, rotate: 7,   scale: 1.03, z: 3 },
    { x: 20, y: 62, rotate: -8,  scale: 1,    z: 1 },
    { x: 40, y: 50, rotate: 4,   scale: 1.04, z: 3 },
    { x: 60, y: 60, rotate: -10, scale: 1,    z: 1 },
    { x: 80, y: 55, rotate: 6,   scale: 1.02, z: 3 },
  ],
  // Page 2
  [
    { x: 8,  y: 10, rotate: 6,   scale: 1.02, z: 3 },
    { x: 26, y: 2,  rotate: -10, scale: 1,    z: 1 },
    { x: 45, y: 12, rotate: 3,   scale: 1.05, z: 3 },
    { x: 64, y: 4,  rotate: -7,  scale: 1,    z: 1 },
    { x: 82, y: 8,  rotate: 11,  scale: 1,    z: 3 },
    { x: 6,  y: 60, rotate: -5,  scale: 1,    z: 1 },
    { x: 24, y: 50, rotate: 9,   scale: 1.03, z: 3 },
    { x: 44, y: 64, rotate: -4,  scale: 1,    z: 1 },
    { x: 62, y: 52, rotate: 7,   scale: 1.04, z: 3 },
    { x: 80, y: 62, rotate: -8,  scale: 1.02, z: 1 },
  ],
  // Page 3
  [
    { x: 6,  y: 8,  rotate: -8,  scale: 1.03, z: 1 },
    { x: 24, y: 4,  rotate: 4,   scale: 1,    z: 3 },
    { x: 42, y: 10, rotate: -6,  scale: 1.02, z: 1 },
    { x: 60, y: 2,  rotate: 10,  scale: 1,    z: 3 },
    { x: 78, y: 9,  rotate: -3,  scale: 1.05, z: 1 },
    { x: 8,  y: 55, rotate: 5,   scale: 1,    z: 3 },
    { x: 26, y: 65, rotate: -9,  scale: 1.04, z: 1 },
    { x: 44, y: 52, rotate: 7,   scale: 1,    z: 3 },
    { x: 64, y: 62, rotate: -5,  scale: 1.02, z: 1 },
    { x: 82, y: 50, rotate: 8,   scale: 1,    z: 3 },
  ],
];`;

let newCode = code.replace(/const scatterLayouts = \[[\s\S]*?\];\n/, newLayouts + '\n');

const newSvg = `{/* 느슨한 끈 SVG */}
            <svg className="string-svg" viewBox="0 0 1000 600" preserveAspectRatio="none">
              {/* 윗줄 끈 */}
              <path
                d="M -50 150 C 200 250, 400 50, 700 150 S 950 50, 1050 120"
                fill="none"
                stroke="#b8a08a"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="10 5"
              />
              {/* 아랫줄 끈 */}
              <path
                d="M -50 480 C 200 580, 500 420, 800 520 S 1000 420, 1050 480"
                fill="none"
                stroke="#b8a08a"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="10 5"
              />
            </svg>`;

newCode = newCode.replace(/\{\/\* 느슨한 끈 SVG \*\/\}[\s\S]*?<\/svg>/, newSvg);

fs.writeFileSync('src/App.jsx', newCode);
console.log('App.jsx updated');
