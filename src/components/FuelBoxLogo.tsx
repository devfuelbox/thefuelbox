"use client";

import { useEffect, useRef } from "react";

// ─── The FuelBox animated logo ────────────────────────────────────────────
// Ported from the reference calculator HTML ("The FuelBox · Daily Nutrition
// Calculator"). It plays one ~1.3s sequence on mount (base drops in, lid
// settles, knob pops, shine sweeps, the "THE" bar lifts, then three steam
// wisps rise and waft) and then holds still. Tapping the mark peeks the lid
// open and puffs the steam. Reduced-motion users get the still logo.
//
// The class names / keyframe names are prefixed `fb-logo-` so they cannot
// collide with Tailwind or any other global stylesheet on the site.

const FOREST = "#1F3D2B";

const LOGO_CSS = `
.fb-logo{display:block;width:84px;height:auto;margin:0 auto;color:${FOREST};overflow:visible;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fb-logo-mark{font-family:'Lora',Georgia,'Times New Roman',serif;font-weight:500;letter-spacing:.2em;color:${FOREST};font-size:24px;line-height:1.2;margin-top:8px;text-align:center}
.fb-logo-rule{width:48px;height:2px;background:${FOREST};margin:8px auto 0}
@media (max-width:480px){
  .fb-logo{width:52px}
  .fb-logo-mark{font-size:17px;margin-top:4px}
  .fb-logo-rule{margin-top:6px}
}
@media (prefers-reduced-motion:no-preference){
  .fb-logo .base{animation:fb-logo-baseIn .35s ease-out both}
  .fb-logo .lid{transform-box:fill-box;transform-origin:right bottom;animation:fb-logo-lidDrop .5s .1s cubic-bezier(.3,1.45,.55,1) backwards;transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
  .fb-logo .knob{transform-box:fill-box;transform-origin:center bottom;animation:fb-logo-knobPop .35s .55s cubic-bezier(.3,1.7,.5,1) backwards}
  .fb-logo .shine{stroke-dasharray:240;animation:fb-logo-shine .5s .7s ease-out backwards}
  .fb-logo .bar{transform-box:fill-box;transform-origin:center;animation:fb-logo-barLift .7s .5s ease-in-out}
  .fb-logo .steam path{stroke-dasharray:110;transform-box:fill-box;transform-origin:center bottom}
  .fb-logo .steam path:nth-child(1){animation:fb-logo-steamUp .5s .5s ease-out backwards, fb-logo-waft 2.2s 1.3s ease-in-out 3}
  .fb-logo .steam path:nth-child(2){animation:fb-logo-steamUp .5s .6s ease-out backwards, fb-logo-waft 2.2s 1.5s ease-in-out 3}
  .fb-logo .steam path:nth-child(3){animation:fb-logo-steamUp .5s .7s ease-out backwards, fb-logo-waft 2.2s 1.7s ease-in-out 3}
  /* Tap: the lid peeks open and the steam puffs out */
  .fb-logo.open .lid{transform:translateY(-12px) rotate(12deg)}
  .fb-logo.open .steam{animation:fb-logo-puff .7s ease-out}
  .fb-logo-mark{animation:fb-logo-markIn .55s .65s ease-out both}
  .fb-logo-rule{animation:fb-logo-ruleIn .4s .95s ease-out both}
  @keyframes fb-logo-knobPop{from{transform:scale(0)}to{transform:none}}
  @keyframes fb-logo-shine{from{stroke-dashoffset:240}to{stroke-dashoffset:0}}
  @keyframes fb-logo-barLift{0%,100%{transform:none}45%{transform:translateY(-18px)}60%{transform:translateY(-18px)}}
  @keyframes fb-logo-waft{0%,100%{opacity:1;transform:none}50%{opacity:.4;transform:translateY(-10px) scaleY(1.08)}}
  @keyframes fb-logo-puff{0%{transform:none;opacity:1}45%{transform:translateY(-26px);opacity:.25}100%{transform:none;opacity:1}}
  @keyframes fb-logo-baseIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  @keyframes fb-logo-lidDrop{from{opacity:0;transform:translateY(-70px)}to{opacity:1;transform:none}}
  @keyframes fb-logo-steamUp{from{stroke-dashoffset:110}to{stroke-dashoffset:0}}
  @keyframes fb-logo-markIn{from{opacity:0;transform:translateY(6px);letter-spacing:.4em}to{opacity:1;transform:none;letter-spacing:.2em}}
  @keyframes fb-logo-ruleIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
}
`;

export function FuelBoxLogo({
  showWordmark = true,
  showRule = true,
}: {
  showWordmark?: boolean;
  showRule?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tap the mark: lid peeks open, steam puffs (mirrors the reference HTML).
  const handleClick = () => {
    const el = svgRef.current;
    if (!el) return;
    el.classList.remove("open");
    void el.getBoundingClientRect(); // force reflow so the class can re-trigger
    el.classList.add("open");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => el.classList.remove("open"), 900);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style dangerouslySetInnerHTML={{ __html: LOGO_CSS }} />
      <svg
        ref={svgRef}
        className="fb-logo"
        viewBox="40 25 560 600"
        role="img"
        aria-label="The FuelBox logo"
        onClick={handleClick}
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

      {showWordmark && <div className="fb-logo-mark">FUELBOX</div>}
      {showRule && <div className="fb-logo-rule" />}
    </div>
  );
}

export default FuelBoxLogo;
