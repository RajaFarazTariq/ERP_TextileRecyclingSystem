import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';

// ── Real-time clock hook ──────────────────────────────────────────────────────
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Context-aware greeting ────────────────────────────────────────────────────
function getGreeting(hour) {
  if (hour < 5)  return { text: 'Good night',     icon: '🌙' };
  if (hour < 12) return { text: 'Good morning',   icon: '☀️' };
  if (hour < 17) return { text: 'Good afternoon', icon: '🌤️' };
  if (hour < 21) return { text: 'Good evening',   icon: '🌆' };
  return           { text: 'Good night',           icon: '🌙' };
}

// ── Detect dark mode ──────────────────────────────────────────────────────────
function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains('dark'));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

// ── DARK MODE Textile Illustration ───────────────────────────────────────────
function TextileIllustrationDark() {
  return (
    <svg
      viewBox="0 0 960 440"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="d-skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#020c1b" />
          <stop offset="45%"  stopColor="#0d2137" />
          <stop offset="100%" stopColor="#071a2e" />
        </linearGradient>
        <linearGradient id="d-rollBlue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="d-rollTeal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#0d9488" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#115e59" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="d-rollPurple" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="d-beltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#047857" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#022c22" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="d-factoryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#1e293b" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
        </linearGradient>
        <filter id="d-softglow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="d-vigLeft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#020c1b" stopOpacity="0.72" />
          <stop offset="55%"  stopColor="#020c1b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#020c1b" stopOpacity="0.05" />
        </linearGradient>
        <clipPath id="d-sceneClip"><rect width="960" height="440" /></clipPath>
      </defs>

      <rect width="960" height="440" fill="url(#d-skyGrad)" />

      {/* Stars */}
      {[[80,30],[160,55],[240,20],[340,45],[520,15],[610,38],[720,22],[820,50],[900,28],
        [50,90],[130,75],[300,85],[430,60],[680,72],[780,88],[870,65]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={i%3===0?1.2:0.7} fill="#7dd3fc" opacity={0.3+i%4*0.1} />
      ))}

      <ellipse cx="480" cy="440" rx="500" ry="80" fill="#1d4ed8" opacity="0.08" />

      {/* Factory */}
      <ellipse cx="790" cy="422" rx="130" ry="10" fill="#000" opacity="0.3" />
      <rect x="830" y="250" width="80" height="170" rx="2" fill="url(#d-factoryGrad)" />
      {[0,1].map(i => <rect key={i} x={845} y={270+i*45} width="22" height="28" rx="2" fill="#1e40af" opacity="0.35" />)}
      <rect x="690" y="200" width="175" height="220" rx="3" fill="url(#d-factoryGrad)" />
      <polygon points="680,202 777,158 880,202" fill="#0f172a" opacity="0.9" />
      {[0,1,2].map(i => (
        <g key={i}>
          <rect x={706+i*48} y={228} width="30" height="36" rx="3" fill="#1e3a8a" opacity="0.4" />
          <line x1={721+i*48} y1={228} x2={721+i*48} y2={264} stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" />
          <line x1={706+i*48} y1={246} x2={736+i*48} y2={246} stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" />
        </g>
      ))}
      {[0,1,2].map(i => <rect key={i} x={706+i*48} y={282} width="30" height="30" rx="3" fill="#1e3a8a" opacity="0.3" />)}
      <rect x="752" y="358" width="52" height="62" rx="4" fill="#0f2744" opacity="0.85" />
      <circle cx="800" cy="390" r="3" fill="#60a5fa" opacity="0.6" />
      <rect x="720" y="115" width="22" height="88" rx="3" fill="#1e293b" opacity="0.85" />
      <rect x="760" y="130" width="18" height="72" rx="3" fill="#1e293b" opacity="0.8" />
      <rect x="800" y="140" width="20" height="62" rx="3" fill="#1e293b" opacity="0.75" />
      <circle cx="731" cy="103" r="12" fill="#64748b" opacity="0.18" />
      <circle cx="724" cy="90"  r="9"  fill="#64748b" opacity="0.14" />
      <circle cx="769" cy="122" r="10" fill="#64748b" opacity="0.16" />
      <circle cx="810" cy="132" r="11" fill="#64748b" opacity="0.15" />

      {/* Fabric rolls */}
      <ellipse cx="155" cy="425" rx="145" ry="10" fill="#000" opacity="0.25" />
      <ellipse cx="130" cy="335" rx="62" ry="25" fill="#1e3a8a" opacity="0.55" />
      <rect x="68" y="230" width="124" height="105" rx="5" fill="url(#d-rollBlue)" />
      <ellipse cx="130" cy="230" rx="62" ry="25" fill="#3b82f6" opacity="0.65" />
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={80+i*22} y1={232} x2={80+i*22} y2={333} stroke="#93c5fd" strokeWidth={i%2===0?1.5:1} opacity={i%2===0?0.45:0.3} />
      ))}
      <ellipse cx="238" cy="350" rx="48" ry="19" fill="#115e59" opacity="0.5" />
      <rect x="190" y="265" width="96" height="85" rx="4" fill="url(#d-rollTeal)" />
      <ellipse cx="238" cy="265" rx="48" ry="19" fill="#0d9488" opacity="0.6" />
      <ellipse cx="45" cy="375" rx="35" ry="14" fill="#4c1d95" opacity="0.55" />
      <rect x="10" y="305" width="70" height="70" rx="4" fill="url(#d-rollPurple)" />
      <ellipse cx="45" cy="305" rx="35" ry="14" fill="#7c3aed" opacity="0.6" />

      {/* Conveyor belt */}
      <rect x="290" y="322" width="380" height="32" rx="16" fill="#052e16" opacity="0.7" />
      <rect x="296" y="328" width="368" height="20" rx="10" fill="url(#d-beltGrad)" />
      {[...Array(11)].map((_,i) => (
        <rect key={i} x={308+i*32} y={330} width="20" height="16" rx="3" fill="#10b981" opacity={i%2===0?0.28:0.18} />
      ))}
      <circle cx="306" cy="338" r="14" fill="#065f46" opacity="0.8" />
      <circle cx="306" cy="338" r="8"  fill="#047857" opacity="0.9" />
      <circle cx="306" cy="338" r="3"  fill="#10b981" opacity="0.7" />
      <circle cx="664" cy="338" r="14" fill="#065f46" opacity="0.8" />
      <circle cx="664" cy="338" r="8"  fill="#047857" opacity="0.9" />
      <circle cx="664" cy="338" r="3"  fill="#10b981" opacity="0.7" />

      {/* Bales */}
      <rect x="330" y="285" width="82" height="38" rx="6" fill="#1d4ed8" opacity="0.6" />
      <rect x="328" y="300" width="86" height="5" rx="2" fill="#60a5fa" opacity="0.55" />
      <rect x="520" y="285" width="82" height="38" rx="6" fill="#065f46" opacity="0.65" />
      <rect x="518" y="300" width="86" height="5" rx="2" fill="#10b981" opacity="0.55" />

      {/* Recycle loop */}
      <circle cx="480" cy="135" r="82" fill="#10b981" opacity="0.04" filter="url(#d-softglow)" />
      <path d="M 480 58 A 77 77 0 0 1 557 115" stroke="#10b981" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.65" />
      <path d="M 557 115 A 77 77 0 0 1 418 190" stroke="#34d399" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M 418 190 A 77 77 0 0 1 480 58"  stroke="#6ee7b7" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.45" />
      <polygon points="553,103 562,118 547,117" fill="#10b981" opacity="0.75" />
      <polygon points="422,198 414,183 430,185" fill="#34d399" opacity="0.65" />
      <polygon points="488,52 474,59 482,71"   fill="#6ee7b7" opacity="0.55" />
      <circle cx="480" cy="135" r="32" fill="#022c22" opacity="0.75" />
      <circle cx="480" cy="135" r="24" fill="#065f46" opacity="0.7" />
      <path d="M480 118 L490 135 L470 135 Z" fill="#10b981" opacity="0.85" />

      {/* Grid */}
      <g opacity="0.055" clipPath="url(#d-sceneClip)">
        {[...Array(18)].map((_,i) => <line key={`h${i}`} x1="610" y1={8+i*20} x2="960" y2={8+i*20} stroke="#cbd5e1" strokeWidth="1" />)}
        {[...Array(20)].map((_,i) => <line key={`v${i}`} x1={612+i*18} y1="0" x2={612+i*18} y2="360" stroke="#cbd5e1" strokeWidth="1" />)}
      </g>

      {/* Threads */}
      <path d="M590 55 Q630 90 612 135 Q594 180 635 215" stroke="#60a5fa" strokeWidth="1.5" fill="none" opacity="0.18" strokeDasharray="6 5" />
      <path d="M655 30 Q695 72 675 118 Q655 164 698 200" stroke="#34d399" strokeWidth="1.5" fill="none" opacity="0.18" strokeDasharray="6 5" />

      <line x1="0" y1="420" x2="960" y2="420" stroke="#1e3a8a" strokeWidth="1" opacity="0.3" />
      <rect x="0" y="420" width="960" height="20" fill="#020c1b" opacity="0.5" />
      <rect width="960" height="440" fill="url(#d-vigLeft)" />
    </svg>
  );
}

// ── LIGHT MODE Textile Illustration ──────────────────────────────────────────
function TextileIllustrationLight() {
  return (
    <svg
      viewBox="0 0 960 440"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* Bright sky — cool teal-to-blue daylight */}
        <linearGradient id="l-skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#0ea5e9" />
          <stop offset="40%"  stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
        {/* Ground strip */}
        <linearGradient id="l-groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#d1fae5" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>
        {/* Fabric rolls */}
        <linearGradient id="l-rollBlue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1e40af" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="l-rollTeal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#0d9488" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="l-rollOrange" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#f97316" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0.7" />
        </linearGradient>
        {/* Belt */}
        <linearGradient id="l-beltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </linearGradient>
        {/* Factory */}
        <linearGradient id="l-factoryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="l-roofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        {/* Sun glow */}
        <radialGradient id="l-sunGlow" cx="85%" cy="12%" r="18%">
          <stop offset="0%"   stopColor="#fef08a" stopOpacity="0.9" />
          <stop offset="50%"  stopColor="#fde047" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        {/* Clouds */}
        <filter id="l-cloud" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {/* Left vignette for readability */}
        <linearGradient id="l-vigLeft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#0369a1" stopOpacity="0.65" />
          <stop offset="50%"  stopColor="#0369a1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.0" />
        </linearGradient>
        <filter id="l-softglow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="l-sceneClip"><rect width="960" height="440" /></clipPath>
      </defs>

      {/* Sky */}
      <rect width="960" height="440" fill="url(#l-skyGrad)" />

      {/* Sun glow */}
      <rect width="960" height="440" fill="url(#l-sunGlow)" />

      {/* Sun disc */}
      <circle cx="870" cy="52" r="30" fill="#fef08a" opacity="0.9" />
      <circle cx="870" cy="52" r="22" fill="#fde047" opacity="0.95" />
      {/* Sun rays */}
      {[...Array(8)].map((_,i) => {
        const angle = i * 45 * Math.PI / 180;
        const x1 = 870 + Math.cos(angle) * 34;
        const y1 = 52  + Math.sin(angle) * 34;
        const x2 = 870 + Math.cos(angle) * 44;
        const y2 = 52  + Math.sin(angle) * 44;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fde047" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />;
      })}

      {/* Clouds */}
      <g opacity="0.88">
        {/* Cloud 1 */}
        <ellipse cx="200" cy="65" rx="60" ry="22" fill="white" />
        <ellipse cx="165" cy="72" rx="38" ry="18" fill="white" />
        <ellipse cx="240" cy="72" rx="42" ry="18" fill="white" />
        <ellipse cx="200" cy="80" rx="65" ry="14" fill="white" />
        {/* Cloud 2 */}
        <ellipse cx="560" cy="45" rx="50" ry="18" fill="white" opacity="0.9" />
        <ellipse cx="530" cy="52" rx="32" ry="15" fill="white" opacity="0.9" />
        <ellipse cx="590" cy="52" rx="36" ry="15" fill="white" opacity="0.9" />
        {/* Cloud 3 — small */}
        <ellipse cx="730" cy="78" rx="35" ry="14" fill="white" opacity="0.75" />
        <ellipse cx="710" cy="84" rx="22" ry="11" fill="white" opacity="0.75" />
        <ellipse cx="752" cy="84" rx="25" ry="11" fill="white" opacity="0.75" />
      </g>

      {/* Ground strip */}
      <rect x="0" y="385" width="960" height="55" fill="url(#l-groundGrad)" />
      {/* Ground line */}
      <line x1="0" y1="386" x2="960" y2="386" stroke="#6ee7b7" strokeWidth="1.5" opacity="0.6" />

      {/* ═══ FACTORY — right ═══ */}
      {/* Shadow */}
      <ellipse cx="790" cy="392" rx="135" ry="8" fill="#0f172a" opacity="0.15" />

      {/* Side wing */}
      <rect x="835" y="240" width="82" height="148" rx="2" fill="url(#l-factoryGrad)" />
      <rect x="835" y="240" width="82" height="8"   rx="2" fill="url(#l-roofGrad)" />
      {[0,1].map(i => (
        <rect key={i} x={848} y={262+i*42} width="24" height="28" rx="2" fill="#bfdbfe" opacity="0.7" />
      ))}

      {/* Main body */}
      <rect x="688" y="195" width="178" height="193" rx="3" fill="url(#l-factoryGrad)" />
      {/* Roof gable */}
      <polygon points="678,197 777,150 888,197" fill="url(#l-roofGrad)" />
      <line x1="777" y1="150" x2="777" y2="197" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />

      {/* Windows row 1 */}
      {[0,1,2].map(i => (
        <g key={i}>
          <rect x={705+i*48} y={222} width="32" height="36" rx="3" fill="#bfdbfe" opacity="0.8" />
          <line x1={721+i*48} y1={222} x2={721+i*48} y2={258} stroke="#93c5fd" strokeWidth="1" opacity="0.6" />
          <line x1={705+i*48} y1={240} x2={737+i*48} y2={240} stroke="#93c5fd" strokeWidth="1" opacity="0.6" />
        </g>
      ))}
      {/* Windows row 2 */}
      {[0,1,2].map(i => (
        <rect key={i} x={705+i*48} y={276} width="32" height="30" rx="3" fill="#bfdbfe" opacity="0.65" />
      ))}

      {/* Door */}
      <rect x="750" y="336" width="54" height="52" rx="4" fill="#64748b" opacity="0.6" />
      <rect x="752" y="338" width="24" height="50" rx="2" fill="#475569" opacity="0.4" />
      <circle cx="800" cy="364" r="3" fill="#e2e8f0" opacity="0.9" />

      {/* Chimneys */}
      <rect x="718" y="108" width="24" height="44" rx="3" fill="#475569" opacity="0.85" />
      <rect x="758" y="120" width="20" height="32" rx="3" fill="#475569" opacity="0.8" />
      <rect x="798" y="130" width="22" height="22" rx="3" fill="#475569" opacity="0.75" />
      {/* Chimney caps */}
      <rect x="715" y="105" width="30" height="6" rx="2" fill="#334155" opacity="0.9" />
      <rect x="755" y="117" width="26" height="5" rx="2" fill="#334155" opacity="0.85" />
      <rect x="795" y="127" width="28" height="5" rx="2" fill="#334155" opacity="0.8" />

      {/* Smoke — lighter in daylight */}
      <circle cx="730" cy="97"  r="10" fill="#e2e8f0" opacity="0.55" />
      <circle cx="723" cy="85"  r="8"  fill="#f1f5f9" opacity="0.45" />
      <circle cx="737" cy="76"  r="6"  fill="#f8fafc" opacity="0.35" />
      <circle cx="768" cy="110" r="9"  fill="#e2e8f0" opacity="0.5" />
      <circle cx="762" cy="99"  r="7"  fill="#f1f5f9" opacity="0.4" />
      <circle cx="808" cy="120" r="9"  fill="#e2e8f0" opacity="0.45" />

      {/* ═══ FABRIC ROLLS — left cluster ═══ */}
      <ellipse cx="155" cy="392" rx="145" ry="8" fill="#0f172a" opacity="0.12" />

      {/* Large roll — blue */}
      <ellipse cx="130" cy="330" rx="64" ry="26" fill="#1e3a8a" opacity="0.8" />
      <rect x="66" y="222" width="128" height="108" rx="5" fill="url(#l-rollBlue)" />
      <ellipse cx="130" cy="222" rx="64" ry="26" fill="#3b82f6" opacity="0.9" />
      {/* Stripe lines */}
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={78+i*23} y1={224} x2={78+i*23} y2={328} stroke="#bfdbfe" strokeWidth={i%2===0?1.8:1.2} opacity={i%2===0?0.55:0.4} />
      ))}
      <ellipse cx="130" cy="262" rx="64" ry="9" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.35" />
      <ellipse cx="130" cy="295" rx="64" ry="9" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.25" />

      {/* Medium roll — teal */}
      <ellipse cx="240" cy="347" rx="50" ry="20" fill="#0f766e" opacity="0.75" />
      <rect x="190" y="260" width="100" height="87" rx="4" fill="url(#l-rollTeal)" />
      <ellipse cx="240" cy="260" rx="50" ry="20" fill="#14b8a6" opacity="0.9" />
      {[0,1,2,3].map(i => (
        <line key={i} x1={203+i*25} y1={262} x2={203+i*25} y2={345} stroke="#99f6e4" strokeWidth="1.2" opacity="0.45" />
      ))}

      {/* Small roll — orange */}
      <ellipse cx="46" cy="374" rx="36" ry="15" fill="#c2410c" opacity="0.7" />
      <rect x="10" y="302" width="72" height="72" rx="4" fill="url(#l-rollOrange)" />
      <ellipse cx="46" cy="302" rx="36" ry="15" fill="#f97316" opacity="0.9" />
      {[0,1,2].map(i => (
        <line key={i} x1={22+i*24} y1={304} x2={22+i*24} y2={372} stroke="#fed7aa" strokeWidth="1.2" opacity="0.45" />
      ))}

      {/* ═══ CONVEYOR BELT — center ═══ */}
      <rect x="290" y="320" width="382" height="34" rx="17" fill="url(#l-beltGrad)" opacity="0.85" />
      <rect x="297" y="327" width="368" height="20" rx="10" fill="#374151" opacity="0.7" />
      {[...Array(11)].map((_,i) => (
        <rect key={i} x={310+i*32} y={329} width="20" height="16" rx="3"
          fill="#6ee7b7" opacity={i%2===0?0.4:0.25} />
      ))}
      {/* Rollers */}
      <circle cx="307" cy="337" r="15" fill="#1f2937" opacity="0.85" />
      <circle cx="307" cy="337" r="9"  fill="#374151" opacity="0.9" />
      <circle cx="307" cy="337" r="3"  fill="#6ee7b7" opacity="0.8" />
      <circle cx="665" cy="337" r="15" fill="#1f2937" opacity="0.85" />
      <circle cx="665" cy="337" r="9"  fill="#374151" opacity="0.9" />
      <circle cx="665" cy="337" r="3"  fill="#6ee7b7" opacity="0.8" />

      {/* Bale 1 — blue */}
      <rect x="328" y="282" width="84" height="40" rx="6" fill="#1d4ed8" opacity="0.85" />
      {[0,1,2,3].map(i => (
        <line key={i} x1={342+i*20} y1={282} x2={342+i*20} y2={322} stroke="#bfdbfe" strokeWidth="1.2" opacity="0.55" />
      ))}
      <rect x="326" y="298" width="88" height="5" rx="2" fill="#93c5fd" opacity="0.7" />

      {/* Bale 2 — green (processed) */}
      <rect x="518" y="282" width="84" height="40" rx="6" fill="#059669" opacity="0.85" />
      {[0,1,2,3].map(i => (
        <line key={i} x1={532+i*20} y1={282} x2={532+i*20} y2={322} stroke="#6ee7b7" strokeWidth="1.2" opacity="0.55" />
      ))}
      <rect x="516" y="298" width="88" height="5" rx="2" fill="#34d399" opacity="0.7" />

      {/* ═══ RECYCLE LOOP — top center ═══ */}
      <circle cx="480" cy="132" r="82" fill="#059669" opacity="0.06" filter="url(#l-softglow)" />
      <path d="M 480 55 A 77 77 0 0 1 557 112" stroke="#059669" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M 557 112 A 77 77 0 0 1 418 187" stroke="#10b981" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M 418 187 A 77 77 0 0 1 480 55"  stroke="#34d399" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5" />
      <polygon points="553,100 562,115 547,114" fill="#059669" opacity="0.8" />
      <polygon points="422,195 414,180 430,182" fill="#10b981" opacity="0.7" />
      <polygon points="488,49 474,56 482,68"   fill="#34d399" opacity="0.6" />
      <circle cx="480" cy="132" r="33" fill="#d1fae5" opacity="0.9" />
      <circle cx="480" cy="132" r="24" fill="#a7f3d0" opacity="0.95" />
      <path d="M480 115 L492 132 L468 132 Z" fill="#059669" opacity="0.9" />
      <line x1="480" y1="132" x2="480" y2="148" stroke="#059669" strokeWidth="2.5" opacity="0.7" />

      {/* ═══ WOVEN GRID — upper right ═══ */}
      <g opacity="0.08" clipPath="url(#l-sceneClip)">
        {[...Array(18)].map((_,i) => <line key={`h${i}`} x1="600" y1={5+i*20} x2="960" y2={5+i*20} stroke="#1e3a8a" strokeWidth="1" />)}
        {[...Array(22)].map((_,i) => <line key={`v${i}`} x1={600+i*17} y1="0" x2={600+i*17} y2="360" stroke="#1e3a8a" strokeWidth="1" />)}
        {[...Array(6)].map((_,r) =>
          [...Array(10)].map((_,c) => (
            <circle key={`d${r}-${c}`} cx={609+c*34} cy={15+r*40} r="1.5" fill="#1e3a8a" opacity="0.8" />
          ))
        )}
      </g>

      {/* Threads */}
      <path d="M588 52 Q628 88 610 132 Q592 176 633 212" stroke="#0369a1" strokeWidth="1.5" fill="none" opacity="0.25" strokeDasharray="6 5" />
      <path d="M652 28 Q692 70 672 116 Q652 162 695 198" stroke="#059669" strokeWidth="1.5" fill="none" opacity="0.25" strokeDasharray="6 5" />
      <path d="M555 96 Q535 138 568 178 Q600 218 568 262" stroke="#d97706" strokeWidth="1.2" fill="none" opacity="0.2" strokeDasharray="5 6" />

      {/* Left vignette for text legibility */}
      <rect width="960" height="440" fill="url(#l-vigLeft)" />
    </svg>
  );
}

// ── Module card definitions ───────────────────────────────────────────────────
const moduleCards = [
  {
    label: 'Warehouse',
    path: '/warehouse',
    roles: ['admin', 'warehouse_supervisor'],
    color: 'from-blue-500 to-blue-700',
    iconPath: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z',
  },
  {
    label: 'Sorting',
    path: '/sorting',
    roles: ['admin', 'sorting_supervisor'],
    color: 'from-purple-500 to-purple-700',
    iconPath: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  },
  {
    label: 'Decolorization',
    path: '/decolorization',
    roles: ['admin', 'decolorization_supervisor'],
    color: 'from-rose-500 to-rose-700',
    iconPath: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  },
  {
    label: 'Drying',
    path: '/drying',
    roles: ['admin', 'drying_supervisor'],
    color: 'from-orange-500 to-orange-700',
    iconPath: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
  },
  {
    label: 'Sales',
    path: '/sales',
    roles: ['admin'],
    color: 'from-emerald-500 to-emerald-700',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    label: 'Users',
    path: '/users',
    roles: ['admin'],
    color: 'from-amber-500 to-amber-600',
    iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    label: 'Reports',
    path: '/reports',
    roles: ['admin'],
    color: 'from-indigo-500 to-indigo-700',
    iconPath: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useLiveClock();
  const isDark = useIsDark();

  const greeting = getGreeting(now.getHours());
  const visibleModules = moduleCards.filter(m => m.roles.includes(user?.role));

  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <MainLayout>

      {/* ════════════════════════════════════════
          HERO BANNER
      ════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl mb-8 shadow-2xl" style={{ minHeight: '360px' }}>

        {/* Illustrated background — switches with theme */}
        {isDark ? <TextileIllustrationDark /> : <TextileIllustrationLight />}

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-100 dark:from-slate-950 to-transparent" />

        {/* Hero content */}
        <div className="relative z-10 px-10 py-12 flex flex-col justify-between" style={{ minHeight: '360px' }}>

          {/* Live clock */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="font-mono tracking-widest text-emerald-300 dark:text-emerald-400"
                style={{ fontSize: '1.05rem', letterSpacing: '0.18em' }}>
                {timeStr}
              </span>
            </div>
            <p className="text-white/70 dark:text-slate-400 text-xs font-medium tracking-wide pl-4">
              {dateStr}
            </p>
          </div>

          {/* Identity block */}
          <div className="mt-auto">
            <p className="text-emerald-200 dark:text-blue-300 text-sm font-semibold uppercase tracking-[0.22em] mb-2 flex items-center gap-2">
              <span>{greeting.icon}</span>
              {greeting.text}
            </p>

            <h1 className="text-white font-black leading-none mb-3"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', letterSpacing: '-0.02em',
                textShadow: isDark ? 'none' : '0 2px 12px rgba(3,105,161,0.5)' }}>
              {user?.username}
            </h1>

            <p className="text-white/75 dark:text-slate-300 text-sm mb-5 max-w-sm leading-relaxed">
              Textile ERP — Recycling Management Command Centre
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 bg-white/15 border border-white/20 text-white text-xs rounded-full px-4 py-1.5 backdrop-blur-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="capitalize">{user?.role?.replace(/_/g, ' ')}</span>
              </span>

              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs rounded-full px-4 py-1.5 font-semibold transition-all duration-150 shadow-lg shadow-blue-900/40"
                >
                  View Dashboard
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          MODULE CARDS
      ════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-widest">
          Your Modules
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs tabular-nums">
          {visibleModules.length} available
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visibleModules.map((mod) => (
          <button
            key={mod.path}
            onClick={() => navigate(mod.path)}
            className="group text-left bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-400/40 dark:hover:border-blue-500/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${mod.color} flex items-center justify-center text-white shadow group-hover:scale-110 transition-transform duration-200`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={mod.iconPath} />
              </svg>
            </div>
            <span className="text-slate-700 dark:text-slate-200 font-semibold text-sm flex-1 leading-tight">
              {mod.label}
            </span>
            <svg
              className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 flex-shrink-0"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

    </MainLayout>
  );
}
