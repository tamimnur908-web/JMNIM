import React from 'react';

export const AnimatedBotanicalCorner: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Top Right Realistic Swaying Botanical Branch (Zero Clipping, Full Safety Margin) */}
      <div className="absolute -top-2 -right-2 sm:top-0 sm:right-0 w-80 sm:w-[420px] md:w-[520px] h-80 sm:h-[420px] md:h-[500px] animate-branch-sway">
        <svg
          viewBox="-80 -50 680 580"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full filter drop-shadow-xl overflow-visible"
        >
          <defs>
            {/* Rich Emerald Gradient */}
            <linearGradient id="leafGradTop1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="35%" stopColor="#22c55e" />
              <stop offset="85%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#14532d" />
            </linearGradient>

            {/* Deep Forest Gradient */}
            <linearGradient id="leafGradTop2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="30%" stopColor="#16a34a" />
              <stop offset="80%" stopColor="#166534" />
              <stop offset="100%" stopColor="#052e16" />
            </linearGradient>

            {/* Golden Fresh Lime Gradient */}
            <linearGradient id="leafGradTop3" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803d" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>

            {/* Wood Branch Gradient */}
            <linearGradient id="branchWoodTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3e2723" />
              <stop offset="50%" stopColor="#5d4037" />
              <stop offset="100%" stopColor="#271c19" />
            </linearGradient>

            {/* Soft 3D Leaf Shadow */}
            <filter id="leafShadowTop" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#064e3b" floodOpacity="0.22" />
            </filter>
          </defs>

          {/* Main Wooden Branch curving inwards */}
          <path
            d="M 580 0 Q 450 50 370 120 Q 280 200 200 310 Q 150 370 90 420"
            stroke="url(#branchWoodTop)"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />

          {/* Secondary Stems */}
          <path
            d="M 400 100 Q 320 105 260 145"
            stroke="url(#branchWoodTop)"
            strokeWidth="5.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 310 180 Q 230 190 180 240"
            stroke="url(#branchWoodTop)"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 220 280 Q 160 300 120 350"
            stroke="url(#branchWoodTop)"
            strokeWidth="3.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* LEAVES - ALL PLACED WITH GENEROUS INNER MARGIN (NO CLIPPING) */}

          {/* Leaf 1 (Top Upper) */}
          <g className="animate-leaf-1" filter="url(#leafShadowTop)">
            <path
              d="M 450 50 C 420 15 365 20 345 55 C 360 95 410 95 450 50 Z"
              fill="url(#leafGradTop1)"
            />
            <path d="M 450 50 Q 395 55 345 55" stroke="#86efac" strokeWidth="1.2" opacity="0.65" fill="none" />
          </g>

          {/* Leaf 2 */}
          <g className="animate-leaf-2" filter="url(#leafShadowTop)">
            <path
              d="M 395 105 C 350 60 285 75 265 120 C 295 155 360 150 395 105 Z"
              fill="url(#leafGradTop2)"
            />
            <path d="M 395 105 Q 330 112 265 120" stroke="#bbf7d0" strokeWidth="1.3" opacity="0.75" fill="none" />
          </g>

          {/* Leaf 3 */}
          <g className="animate-leaf-1" filter="url(#leafShadowTop)">
            <path
              d="M 340 135 C 285 95 220 115 200 165 C 235 205 300 195 340 135 Z"
              fill="url(#leafGradTop3)"
            />
            <path d="M 340 135 Q 265 150 200 165" stroke="#bbf7d0" strokeWidth="1.3" opacity="0.75" fill="none" />
          </g>

          {/* Leaf 4 (Full lush center leaf) */}
          <g className="animate-leaf-2" filter="url(#leafShadowTop)">
            <path
              d="M 295 195 C 240 150 165 165 145 225 C 180 270 255 260 295 195 Z"
              fill="url(#leafGradTop1)"
            />
            <path d="M 295 195 Q 215 210 145 225" stroke="#86efac" strokeWidth="1.5" opacity="0.8" fill="none" />
          </g>

          {/* Leaf 5 */}
          <g className="animate-leaf-1" filter="url(#leafShadowTop)">
            <path
              d="M 245 250 C 190 215 125 240 105 300 C 140 340 210 325 245 250 Z"
              fill="url(#leafGradTop2)"
            />
            <path d="M 245 250 Q 170 275 105 300" stroke="#bbf7d0" strokeWidth="1.3" opacity="0.75" fill="none" />
          </g>

          {/* Leaf 6 (Previously clipped leaf - now with +80px space inside viewbox) */}
          <g className="animate-leaf-2" filter="url(#leafShadowTop)">
            <path
              d="M 195 320 C 145 285 75 315 60 375 C 95 415 160 395 195 320 Z"
              fill="url(#leafGradTop3)"
            />
            <path d="M 195 320 Q 125 345 60 375" stroke="#bbf7d0" strokeWidth="1.3" opacity="0.75" fill="none" />
          </g>

          {/* Leaf 7 (Branch Tip Leaf - Fully intact and rounded, centered at x=105, y=410) */}
          <g className="animate-leaf-1" filter="url(#leafShadowTop)">
            <path
              d="M 125 400 C 85 375 45 405 40 440 C 68 465 110 445 125 400 Z"
              fill="url(#leafGradTop1)"
            />
            <path d="M 125 400 Q 80 420 40 440" stroke="#86efac" strokeWidth="1.2" opacity="0.75" fill="none" />
          </g>

          {/* Natural side leaflets */}
          <path
            d="M 370 85 C 345 50 305 55 295 80 C 308 108 340 102 370 85 Z"
            fill="url(#leafGradTop3)"
            opacity="0.9"
          />
          <path
            d="M 275 165 C 248 135 210 142 198 165 C 210 192 248 188 275 165 Z"
            fill="url(#leafGradTop2)"
            opacity="0.9"
          />
          <path
            d="M 175 270 C 150 242 112 248 100 272 C 112 298 150 292 175 270 Z"
            fill="url(#leafGradTop1)"
            opacity="0.9"
          />
        </svg>
      </div>

      {/* Floating Single Leaf Drifting Softly */}
      <div className="absolute top-28 right-52 sm:right-72 animate-drift hidden sm:block">
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
          <path
            d="M 38 2 C 24 2 8 16 4 26 C 9 36 24 36 38 2 Z"
            fill="#22c55e"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
          />
        </svg>
      </div>

      {/* Bottom Left: Natural Upright Botanical Branch Growing Upward & Inward */}
      <div className="absolute -bottom-4 -left-4 sm:bottom-0 sm:left-0 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 animate-branch-sway-left">
        <svg
          viewBox="-40 -40 420 420"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full filter drop-shadow-md overflow-visible"
        >
          <defs>
            <linearGradient id="leafGradBottom1" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803d" />
              <stop offset="60%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#86efac" />
            </linearGradient>

            <linearGradient id="leafGradBottom2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#166534" />
              <stop offset="50%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>

            <linearGradient id="branchWoodBottom" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#271c19" />
              <stop offset="60%" stopColor="#4e342e" />
              <stop offset="100%" stopColor="#6d4c41" />
            </linearGradient>

            <filter id="leafShadowBottom" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#064e3b" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Stem growing naturally UPWARDS and curving right */}
          <path
            d="M 10 380 Q 50 280 90 200 Q 130 120 190 60 Q 230 20 270 0"
            stroke="url(#branchWoodBottom)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />

          {/* Small side twig */}
          <path
            d="M 60 250 Q 110 240 145 210"
            stroke="url(#branchWoodBottom)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 120 150 Q 170 140 205 110"
            stroke="url(#branchWoodBottom)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Upright Leaves arranged naturally along the stem */}

          {/* Leaf 1 (Lower stem left) */}
          <g className="animate-leaf-1" filter="url(#leafShadowBottom)">
            <path
              d="M 40 290 C 15 250 20 205 45 185 C 65 210 65 260 40 290 Z"
              fill="url(#leafGradBottom1)"
            />
            <path d="M 40 290 Q 30 240 45 185" stroke="#bbf7d0" strokeWidth="1" opacity="0.7" fill="none" />
          </g>

          {/* Leaf 2 (Lower stem right) */}
          <g className="animate-leaf-2" filter="url(#leafShadowBottom)">
            <path
              d="M 60 250 C 95 220 140 230 155 260 C 130 280 85 275 60 250 Z"
              fill="url(#leafGradBottom2)"
            />
            <path d="M 60 250 Q 110 245 155 260" stroke="#bbf7d0" strokeWidth="1" opacity="0.7" fill="none" />
          </g>

          {/* Leaf 3 (Middle stem left) */}
          <g className="animate-leaf-1" filter="url(#leafShadowBottom)">
            <path
              d="M 85 205 C 60 165 70 120 100 100 C 115 130 110 175 85 205 Z"
              fill="url(#leafGradBottom1)"
            />
            <path d="M 85 205 Q 80 155 100 100" stroke="#bbf7d0" strokeWidth="1" opacity="0.7" fill="none" />
          </g>

          {/* Leaf 4 (Middle stem right) */}
          <g className="animate-leaf-2" filter="url(#leafShadowBottom)">
            <path
              d="M 120 150 C 160 120 205 130 220 160 C 195 180 150 175 120 150 Z"
              fill="url(#leafGradBottom2)"
            />
            <path d="M 120 150 Q 170 145 220 160" stroke="#bbf7d0" strokeWidth="1" opacity="0.7" fill="none" />
          </g>

          {/* Leaf 5 (Upper stem left) */}
          <g className="animate-leaf-1" filter="url(#leafShadowBottom)">
            <path
              d="M 155 100 C 135 60 150 20 180 5 C 195 35 185 75 155 100 Z"
              fill="url(#leafGradBottom1)"
            />
            <path d="M 155 100 Q 155 55 180 5" stroke="#bbf7d0" strokeWidth="1" opacity="0.7" fill="none" />
          </g>

          {/* Leaf 6 (Top tip flourishing upright leaf) */}
          <g className="animate-leaf-2" filter="url(#leafShadowBottom)">
            <path
              d="M 210 45 C 240 15 285 10 305 35 C 285 65 240 65 210 45 Z"
              fill="url(#leafGradBottom2)"
            />
            <path d="M 210 45 Q 260 25 305 35" stroke="#bbf7d0" strokeWidth="1.2" opacity="0.8" fill="none" />
          </g>
        </svg>
      </div>
    </div>
  );
};
