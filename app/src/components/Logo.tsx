interface LogoProps {
  withText?: boolean;
  height?: number;
  variant?: "dark" | "light";
}

export default function Logo({
  withText = false,
  height = 36,
  variant = "dark",
}: LogoProps) {
  const iconSize = height;
  const fontSize = Math.round(height * 0.44);

  const textPrimary = variant === "dark" ? "#e9d5ff" : "#6d28d9";
  const textAccent = variant === "dark" ? "#a78bfa" : "#7c3aed";

  const textWidth = fontSize * 14.2;
  const totalWidth = withText ? 44 + 8 + textWidth : 44;

  return (
    <svg
      height={iconSize}
      viewBox={`0 0 ${totalWidth} 44`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Repository Augur"
    >
      <defs>
        <linearGradient
          id="rc-bg"
          x1="0"
          y1="0"
          x2="44"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <radialGradient
          id="rc-glow"
          cx="40%"
          cy="30%"
          r="55%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rc-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="44" height="44" rx="11" fill="url(#rc-bg)" />
      <rect x="0" y="0" width="44" height="44" rx="11" fill="url(#rc-glow)" />
      <rect x="0" y="0" width="44" height="22" rx="11" fill="url(#rc-shine)" />

      <rect
        x="7"
        y="8"
        width="28"
        height="20"
        rx="5"
        fill="white"
        fillOpacity="0.15"
      />
      <path d="M11 28 L11 34 L17 28 Z" fill="white" fillOpacity="0.15" />

      <polyline
        points="15,14 11,18 15,22"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1="21"
        y1="13"
        x2="18"
        y2="23"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <polyline
        points="24,14 28,18 24,22"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {withText && (
        <text
          x="52"
          y="30"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="700"
          fontSize={fontSize}
        >
          <tspan fill={textPrimary}>Repository </tspan>
          <tspan fill={textAccent}>Augur</tspan>
        </text>
      )}
    </svg>
  );
}
