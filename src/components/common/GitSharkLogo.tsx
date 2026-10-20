import React from "react";

export interface GitSharkLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | number;
  withBackground?: boolean;
  withGlow?: boolean;
  animated?: boolean;
  flipX?: boolean;
  glowColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  xs: "w-3.5 h-3.5",
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-9 h-9",
  xl: "w-12 h-12",
  "2xl": "w-16 h-16",
  "3xl": "w-24 h-24",
};

export const GitSharkLogo: React.FC<GitSharkLogoProps> = ({
  size = "md",
  withBackground = false,
  withGlow = true,
  animated = false,
  flipX = false,
  glowColor,
  className = "",
  style,
}) => {
  const isNumericSize = typeof size === "number";
  const sizeClass = isNumericSize
    ? ""
    : (SIZE_MAP[size as keyof typeof SIZE_MAP] || size);
  const idPrefix = React.useId().replace(/:/g, "_");

  const bgGradId = `${idPrefix}-bgGrad`;
  const oceanGlowId = `${idPrefix}-oceanGlow`;
  const sharkDorsalId = `${idPrefix}-sharkDorsal`;
  const sharkFinId = `${idPrefix}-sharkFin`;
  const sharkBellyId = `${idPrefix}-sharkBelly`;
  const dagBranchAId = `${idPrefix}-dagBranchA`;
  const dagBranchBId = `${idPrefix}-dagBranchB`;
  const dagBranchCId = `${idPrefix}-dagBranchC`;
  const neonHaloId = `${idPrefix}-neonHalo`;
  const dropShadowId = `${idPrefix}-dropShadow`;

  const viewBox = withBackground ? "0 0 512 512" : "68 80 394 340";

  const numericWidth = isNumericSize ? size : undefined;
  const numericHeight = isNumericSize
    ? withBackground
      ? size
      : Math.round(size * (340 / 394))
    : undefined;

  const combinedStyle: React.CSSProperties = {
    ...(isNumericSize ? { width: numericWidth, height: numericHeight } : {}),
    ...(flipX ? { transform: "scaleX(-1)", transformOrigin: "center" } : {}),
    ...style,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={`${sizeClass} ${className} flex-shrink-0 select-none overflow-visible`}
      style={combinedStyle}
      fill="none"
    >
      <defs>
        {/* Background Gradients */}
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#070c18" />
          <stop offset="50%" stopColor="#0a1222" />
          <stop offset="100%" stopColor="#050811" />
        </linearGradient>

        <radialGradient id={oceanGlowId} cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.32" />
          <stop offset="45%" stopColor="#0369a1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#070c18" stopOpacity="0" />
        </radialGradient>

        {/* Shark Body Metallic / Cyan Gradient */}
        <linearGradient id={sharkDorsalId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="35%" stopColor="#0284c7" />
          <stop offset="85%" stopColor="#034870" />
          <stop offset="100%" stopColor="#022740" />
        </linearGradient>

        <linearGradient id={sharkFinId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="40%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        <linearGradient id={sharkBellyId} x1="0%" y1="30%" x2="100%" y2="70%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#bae6fd" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.15" />
        </linearGradient>

        {/* Glowing DAG Commit Paths */}
        <linearGradient id={dagBranchAId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="60%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>

        <linearGradient id={dagBranchBId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>

        <linearGradient id={dagBranchCId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>

        {/* Glowing filters */}
        {withGlow && (
          <filter id={neonHaloId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}

        <filter id={dropShadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor={glowColor || "#0284c7"} floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Optional Squircle Background Container */}
      {withBackground && (
        <>
          <rect
            width="512"
            height="512"
            rx="116"
            fill={`url(#${bgGradId})`}
            stroke="#1e293b"
            strokeWidth="2.5"
          />
          <circle cx="256" cy="245" r="215" fill={`url(#${oceanGlowId})`} />
          <g opacity="0.15" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 6">
            <line x1="80" y1="256" x2="432" y2="256" />
            <line x1="256" y1="80" x2="256" y2="432" />
            <circle cx="256" cy="256" r="160" fill="none" />
          </g>
        </>
      )}

      {/* Main Shark Anatomy Group */}
      <g filter={`url(#${dropShadowId})`}>
        {/* Dorsal Fin */}
        <path
          d="M 230 205 C 248 165, 275 110, 305 92 C 309 89, 314 93, 313 98 C 308 135, 296 178, 312 215 Z"
          fill={`url(#${sharkFinId})`}
          stroke="#7dd3fc"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Pectoral Fin */}
        <path
          d="M 185 285 C 175 330, 160 380, 195 410 C 200 414, 207 410, 208 404 C 218 365, 238 325, 252 295 Z"
          fill="#034870"
          stroke="#0284c7"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Shark Torpedo Body */}
        <path
          d="M 82 254 
             C 105 208, 168 180, 240 190 
             C 285 196, 340 215, 388 238 
             C 410 248, 435 240, 448 222
             C 445 250, 430 268, 412 278
             C 432 292, 446 312, 448 335
             C 432 318, 405 310, 380 305
             C 325 295, 265 315, 215 318
             C 152 322, 108 290, 82 254 Z"
          fill={`url(#${sharkDorsalId})`}
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Counter-shading Sleek Belly Highlight */}
        <path
          d="M 82 254 
             C 112 278, 155 312, 225 308
             C 275 305, 325 288, 380 305
             C 345 285, 295 272, 240 272
             C 170 272, 118 250, 82 254 Z"
          fill={`url(#${sharkBellyId})`}
        />

        {/* Stylized Shark Eye */}
        <path d="M 128 234 Q 140 228 152 233 Q 138 240 128 234 Z" fill="#030712" />
        <polygon
          points="132,233 148,231 144,235 134,235"
          fill="#38bdf8"
          filter={withGlow ? `url(#${neonHaloId})` : undefined}
        />
        <circle cx="140" cy="233" r="1.5" fill="#ffffff" />

        {/* Gill Slits (Git diff indicators) */}
        <g stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
          <path d="M 172 242 Q 168 255 174 268" />
          <path d="M 183 240 Q 179 256 186 270" />
          <path d="M 194 238 Q 190 257 198 272" />
        </g>

        {/* Specular Contour Edge */}
        <path
          d="M 86 254 C 150 215, 235 210, 312 215"
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>

      {/* Integrated Git DAG Commit Graph */}
      <g filter={withGlow ? `url(#${neonHaloId})` : undefined}>
        {/* Mainline Highway */}
        <path
          d="M 118 254 C 160 254, 185 242, 230 242 C 275 242, 305 262, 350 262 C 378 262, 400 270, 420 275"
          fill="none"
          stroke={`url(#${dagBranchAId})`}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Dorsal Fin Feature Branch */}
        <path
          d="M 230 242 C 245 210, 270 160, 298 118"
          fill="none"
          stroke={`url(#${dagBranchBId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Pectoral Merge Branch */}
        <path
          d="M 230 242 C 215 280, 195 325, 198 380 C 205 345, 240 310, 280 295 C 315 282, 335 272, 350 262"
          fill="none"
          stroke={`url(#${dagBranchCId})`}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Node 1: Origin */}
        <circle cx="118" cy="254" r="6" fill="#070d18" stroke="#34d399" strokeWidth="2.5" />
        <circle cx="118" cy="254" r="2.5" fill="#34d399" />

        {/* Node 2: Core Fork */}
        <circle
          cx="230"
          cy="242"
          r="7.5"
          fill="#070d18"
          stroke="#38bdf8"
          strokeWidth="3"
          className={animated ? "animate-pulse" : undefined}
        />
        <circle cx="230" cy="242" r="3" fill="#ffffff" />

        {/* Node 3: Dorsal Apex */}
        <circle cx="298" cy="118" r="6" fill="#070d18" stroke="#a78bfa" strokeWidth="2.5" />
        <circle cx="298" cy="118" r="2.5" fill="#c084fc" />

        {/* Node 4: Pectoral Node */}
        <circle cx="198" cy="380" r="5" fill="#070d18" stroke="#f43f5e" strokeWidth="2" />
        <circle cx="198" cy="380" r="2" fill="#fb7185" />

        {/* Node 5: Target Merge */}
        <circle cx="350" cy="262" r="6.5" fill="#070d18" stroke="#38bdf8" strokeWidth="2.5" />
        <circle cx="350" cy="262" r="2.5" fill="#38bdf8" />

        {/* Node 6: Caudal Release Tip */}
        <circle cx="420" cy="275" r="5" fill="#070d18" stroke="#34d399" strokeWidth="2" />
        <circle cx="420" cy="275" r="2" fill="#34d399" />
      </g>

      {/* Orbit Halo around Core Fork */}
      <circle
        cx="230"
        cy="242"
        r="13"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1"
        opacity="0.4"
        strokeDasharray="2 3"
        className={animated ? "animate-spin origin-[230px_242px]" : undefined}
      />
    </svg>
  );
};
