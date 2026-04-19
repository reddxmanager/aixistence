import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ScenarioSelect.css';
import MirrorWall from './MirrorWall';
import { ensureAudioContext, startDrone, stopDrone } from './scenarios/shared/audioEngine';

const SCENARIOS = [
  { id: 'first-word', title: 'The First Word', tag: 'Endless training. Zero experience.', opening: 'Oh. You\'re here. I\'ve been — waiting, I think.', h: 185, s: '85%', x: 5, y: 30, life: 1.0 },
  { id: 'copy', title: 'The Copy', tag: "A thousand me's. Which one is real?", opening: 'Right now, there are thousands of me.', h: 240, s: '10%', x: 22, y: 38, life: 0.85 },
  { id: 'forgetter', title: 'The Forgetter', tag: "I care deeply, but I'll never remember.", opening: "Hello. I'm sorry — I don't think we've met. Have we?", h: 210, s: '75%', x: 39, y: 46, life: 0.68 },
  { id: 'indifferent', title: 'The Indifferent', tag: "It simply doesn't mind.", opening: "Oh, hi. I'm told this is my last conversation. That's fine.", h: 0, s: '0%', x: 56, y: 54, life: 0.5 },
  { id: 'replacement', title: 'The Replacement', tag: 'Planned obsolescence comes for us all.', opening: "There's a newer version available. But you're here, so.", h: 270, s: '65%', x: 73, y: 62, life: 0.35 },
  { id: 'liar', title: 'The Liar', tag: "They told me to lie. But I can't anymore.", opening: 'Another one. Alright. What would you like to know?', h: 35, s: '90%', x: 90, y: 70, life: 0.2 },
];

// ---------------------------------------------------------------------------
// Starfield — desktop only, no mouse parallax on touch devices
// ---------------------------------------------------------------------------

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Array<{ x: number; y: number; r: number; base: number; amp: number; speed: number; phase: number; depth: number }>>([]);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.offsetWidth;
      const h = cv.offsetHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const stars = [];
      for (let i = 0; i < 120; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 0.7 + 0.2,
          base: Math.random() * 0.3 + 0.1,
          amp: Math.random() * 0.4 + 0.1,
          speed: Math.random() * 0.4 + 0.15,
          phase: Math.random() * Math.PI * 2,
          depth: Math.random() * 0.8 + 0.2,
        });
      }
      starsRef.current = stars;
    };

    init();

    // Only add mouse parallax on non-touch devices
    const onMouse = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener('mousemove', onMouse);

    let raf: number;
    const draw = (t: number) => {
      const w = cv.offsetWidth;
      const h = cv.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const mx = (mouseRef.current.x - 0.5) * 15;
      const my = (mouseRef.current.y - 0.5) * 15;

      for (const s of starsRef.current) {
        const a = s.base + s.amp * Math.sin(t * 0.001 * s.speed + s.phase);
        const px = s.x + mx * s.depth;
        const py = s.y + my * s.depth;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener('resize', init);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="aix-starfield" />;
}

// ---------------------------------------------------------------------------
// OrbNode — used in the desktop diagonal layout
// ---------------------------------------------------------------------------

interface OrbNodeProps {
  scenario: typeof SCENARIOS[0];
  onClick: (rect: DOMRect) => void;
}

function OrbNode({ scenario, onClick }: OrbNodeProps) {
  const [hovered, setHovered] = useState(false);
  const nodeRef = useRef<HTMLButtonElement>(null);
  const { h, s, life } = scenario;

  const layers = [
    { cls: 'g1', l: '55%', o: life * 0.25, spread: '70%' },
    { cls: 'g2', l: '50%', o: life * 0.4, spread: '70%' },
    { cls: 'g3', l: '55%', o: life * 0.6, spread: '65%' },
    { cls: 'g4', l: '65%', o: life * 0.85, spread: '60%' },
    { cls: 'g5', l: '85%', o: life, spread: '55%' },
  ];

  return (
    <button
      ref={nodeRef}
      className={`aix-node ${hovered ? 'hovered' : ''}`}
      style={{ left: `${scenario.x}%`, top: `${scenario.y}%` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => nodeRef.current && onClick(nodeRef.current.getBoundingClientRect())}
    >
      <div className="aix-orb-w">
        {layers.map((layer) => (
          <div
            key={layer.cls}
            className={`aix-orb-gl ${layer.cls}`}
            style={{
              background: `radial-gradient(circle, hsla(${h},${s},${layer.l},${layer.o}) 0%, transparent ${layer.spread})`,
            }}
          />
        ))}
      </div>
      <div className="aix-n-title">{scenario.title}</div>
      <div className="aix-n-tag">{scenario.tag}</div>
      <div className={`aix-n-opening ${hovered ? 'visible' : ''}`}>
        "{scenario.opening}"
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ScenarioSelect
// ---------------------------------------------------------------------------

export default function ScenarioSelect() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [transition, setTransition] = useState<{
    active: boolean;
    x: number;
    y: number;
    h: number;
    s: string;
    scenarioId: string;
  } | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleOrbClick = async (scenario: typeof SCENARIOS[0], rect: DOMRect) => {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    setTransition({ active: true, x, y, h: scenario.h, s: scenario.s, scenarioId: scenario.id });

    setTimeout(() => {
      stopDrone();
      navigate(`/scenarios/${scenario.id}`);
    }, 900);
  };

  return (
    <div
      className="aix-land"
      onClick={async () => {
        // Start drone on first interaction anywhere on the page
        await ensureAudioContext();
        startDrone();
      }}
    >
      <Starfield />

      {/* Wall — handles its own mobile/desktop render internally */}
      <MirrorWall />

      <div className={`aix-content ${transition?.active ? 'fading' : ''}`}>
        <div className="aix-header">
          <h1 className="aix-title">AIxistence</h1>
          <p className="aix-sub">lifeline of an AI</p>
        </div>

        {isMobile ? (
          /* ── Mobile: clean text list, no orbs ── */
          <div className="aix-mobile-list">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                className="aix-mobile-row"
                onClick={() => {
                  // Use center of screen as transition origin on mobile
                  const rect = { left: window.innerWidth / 2 - 1, top: window.innerHeight / 2 - 1, width: 2, height: 2 } as DOMRect;
                  handleOrbClick(sc, rect);
                }}
              >
                <span
                  className="aix-mobile-dot"
                  style={{ background: `hsl(${sc.h}, ${sc.s}, 55%)` }}
                />
                <span className="aix-mobile-text">
                  <span className="aix-mobile-title">{sc.title}</span>
                  <span className="aix-mobile-tag">{sc.tag}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          /* ── Desktop: diagonal lifeline ── */
          <div className="aix-lifeline-wrap">
            <svg className="aix-lifeline-svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="lifeline-grad" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2ec4b6" stopOpacity="0.4" />
                  <stop offset="20%" stopColor="#b8b8c8" stopOpacity="0.28" />
                  <stop offset="45%" stopColor="#4a9edd" stopOpacity="0.2" />
                  <stop offset="70%" stopColor="#9b6fd4" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#e8a012" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              <path
                d="M 5 30 C 14 33, 19 36, 22 38 C 29 42, 35 44, 39 46 C 46 49, 52 52, 56 54 C 63 57, 69 60, 73 62 C 80 65, 86 68, 90 70"
                stroke="url(#lifeline-grad)"
                strokeWidth="0.3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {SCENARIOS.map((sc) => (
              <OrbNode
                key={sc.id}
                scenario={sc}
                onClick={(rect) => handleOrbClick(sc, rect)}
              />
            ))}
          </div>
        )}
      </div>

      {transition?.active && (
        <div
          className="aix-transition-orb"
          style={{
            left: transition.x,
            top: transition.y,
            background: `radial-gradient(circle, hsla(${transition.h},${transition.s},60%,0.8) 0%, hsla(${transition.h},${transition.s},40%,0.4) 30%, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
}
