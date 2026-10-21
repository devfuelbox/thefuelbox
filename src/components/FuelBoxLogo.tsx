"use client";

// ─── The FuelBox animated logo ────────────────────────────────────────────
// Ported from "The FuelBox · Logo" reference HTML. It plays a short entrance
// (mark drops in, wordmark settles, rule draws), then holds: the lid rattles
// in a 3s burst-then-rest loop while three steam wisps drift up. Reduced-motion
// users get the still logo with the lid closed.
//
// The class names / keyframe names are prefixed `fb-logo-` so they cannot
// collide with Tailwind or any other global stylesheet on the site.

import { useId } from "react";

const FOREST = "#1F3D2B";

const LOGO_CSS = `
.fb-logo{display:block;width:84px;height:auto;margin:0 auto;color:${FOREST};overflow:visible}
.fb-logo-mark{font-family:'Lora',Georgia,'Times New Roman',serif;font-weight:500;letter-spacing:.2em;color:${FOREST};font-size:24px;line-height:1.2;margin-top:8px;text-align:center}
.fb-logo-rule{width:48px;height:2px;background:${FOREST};margin:8px auto 0}
@media (max-width:480px){
  .fb-logo{width:52px}
  .fb-logo-mark{font-size:17px;margin-top:4px}
  .fb-logo-rule{margin-top:6px}
}

@media (prefers-reduced-motion:no-preference){
  .fb-logo{animation:fb-logo-in .14s cubic-bezier(.33,0,.2,1) both}
  .fb-logo .lid{transform-box:fill-box;transform-origin:center bottom;animation:fb-logo-rattle 3s .25s linear infinite}
  .fb-logo .shine{stroke-dasharray:240;animation:fb-logo-shine .18s .04s cubic-bezier(.4,0,.2,1) backwards}
  .fb-logo .steam path{stroke-dasharray:110;transform-box:fill-box;transform-origin:center bottom}
  .fb-logo .steam path:nth-child(1){animation:fb-logo-steam .14s .05s cubic-bezier(.4,0,.2,1) backwards, fb-logo-drift 6s .35s ease-in-out infinite}
  .fb-logo .steam path:nth-child(2){animation:fb-logo-steam .14s .07s cubic-bezier(.4,0,.2,1) backwards, fb-logo-drift 6s .6s ease-in-out infinite}
  .fb-logo .steam path:nth-child(3){animation:fb-logo-steam .14s .09s cubic-bezier(.4,0,.2,1) backwards, fb-logo-drift 6s .85s ease-in-out infinite}
  .fb-logo-mark{animation:fb-logo-mark .16s .05s cubic-bezier(.33,0,.2,1) both}
  .fb-logo-rule{animation:fb-logo-rule .12s .10s cubic-bezier(.33,0,.2,1) both}

  @keyframes fb-logo-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes fb-logo-shine{from{stroke-dashoffset:240}to{stroke-dashoffset:0}}
  @keyframes fb-logo-steam{from{stroke-dashoffset:110}to{stroke-dashoffset:0}}
  @keyframes fb-logo-mark{from{opacity:0;transform:translateY(6px);letter-spacing:.4em}to{opacity:1;transform:none;letter-spacing:.2em}}
  @keyframes fb-logo-rule{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  /* Idle drift: opacity carries it, displacement is near-subliminal. */
  @keyframes fb-logo-drift{0%,100%{opacity:1;transform:none}50%{opacity:.55;transform:translateY(-22px) scaleY(1.05)}}
  /* Rattle: 0.45s burst, then 2.55s still. Decaying beats, linear so each flick stays sharp. */
  @keyframes fb-logo-rattle{
    0%,15%,100%{transform:none}
    2.5% {transform:translate(-10px,-24px) rotate(6deg)}
    5.65%{transform:translate(12px,-10px)  rotate(-7deg)}
    8.8% {transform:translate(-8px,-18px)  rotate(4.5deg)}
    11.9%{transform:translate(5px,-6px)    rotate(-2.5deg)}
  }
}
`;

export function FuelBoxLogo({
  showWordmark = true,
  showRule = true,
  size,
  color = FOREST,
  wordmarkColor,
  ruleColor,
  className,
}: {
  showWordmark?: boolean;
  showRule?: boolean;
  /** Mark width in px. Omit to use the responsive default (84px / 52px small). */
  size?: number;
  /** Current-colour for the mark (pot, steam, lid, "THE"). */
  color?: string;
  /** Wordmark colour. Defaults to `color`. */
  wordmarkColor?: string;
  /** Rule colour. Defaults to `color`. */
  ruleColor?: string;
  className?: string;
}) {
  // Each instance gets a unique scope class so a fixed `size` on one logo
  // cannot leak onto another (all instances inject the same base CSS).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const scope = `fb-logo-scope-${uid}`;
  const sizedCSS = size
    ? `${LOGO_CSS}\n.${scope} .fb-logo{width:${size}px}`
    : LOGO_CSS;

  return (
    <div className={`${scope}${className ? ` ${className}` : ""}`} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style dangerouslySetInnerHTML={{ __html: sizedCSS }} />
      <svg
        className="fb-logo"
        viewBox="40 25 560 600"
        role="img"
        aria-label="The FuelBox logo"
        style={color === FOREST ? undefined : { color }}
      >
        <g className="base">
          <path d="M62,350 H578" fill="none" stroke="currentColor" strokeWidth={11} strokeLinecap="round" />
          <path
            d="M65,360 A255,255 0 0 0 222,585 M418,585 A255,255 0 0 0 575,360"
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            strokeLinecap="round"
          />
          <g className="bar" fill="currentColor">
            <rect x="230" y="447" width="180" height="8" />
            <rect x="290" y="440" width="60" height="20" rx="3" />
            <rect x="278" y="428" width="12" height="44" rx="3" />
            <rect x="350" y="428" width="12" height="44" rx="3" />
            <rect x="205" y="377" width="30" height="148" rx="6" />
            <rect x="405" y="377" width="30" height="148" rx="6" />
            <rect x="172" y="395" width="26" height="110" rx="6" />
            <rect x="442" y="395" width="26" height="110" rx="6" />
            <rect x="147" y="415" width="18" height="70" rx="5" />
            <rect x="475" y="415" width="18" height="70" rx="5" />
            <rect x="133" y="444" width="16" height="12" />
            <rect x="491" y="444" width="16" height="12" />
          </g>
          <g fill="currentColor">
            <text
              x="320"
              y="602"
              textAnchor="middle"
              fontFamily="Lora, Georgia, serif"
              fontSize={74}
              letterSpacing={3}
            >
              THE
            </text>
          </g>
        </g>
        <g className="steam" fill="none" stroke="currentColor" strokeWidth={9} strokeLinecap="round">
          <path d="M268,320 q12,-12 0,-24 t0,-24 t0,-24" />
          <path d="M327,312 q12,-12 0,-24 t0,-24 t0,-24" />
          <path d="M390,320 q12,-12 0,-24 t0,-24 t0,-24" />
        </g>
        <g className="lid">
          <path className="knob" d="M290,88 A30,30 0 0 1 350,88 Z" fill="currentColor" />
          <path d="M62,345 A258,258 0 0 1 578,345" fill="none" stroke="currentColor" strokeWidth={11} />
          <path
            className="shine"
            d="M95,297 A230,230 0 0 1 240,129"
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            strokeLinecap="round"
          />
        </g>
      </svg>

      {showWordmark && (
        <div
          className="fb-logo-mark"
          style={wordmarkColor || color !== FOREST ? { color: wordmarkColor || color } : undefined}
        >
          FUELBOX
        </div>
      )}
      {showRule && (
        <div
          className="fb-logo-rule"
          style={ruleColor || color !== FOREST ? { background: ruleColor || color } : undefined}
        />
      )}
    </div>
  );
}

export default FuelBoxLogo;
