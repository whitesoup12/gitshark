import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChumStore, type ChumPiece, type FrenzyShark } from "@/store/useChumStore";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";

const CHUM_EMOJIS: Record<ChumPiece["type"], string> = {
  fish: "🐟",
  steak: "🥩",
  shrimp: "🍤",
  squid: "🐙",
  bone: "🦴",
  drop: "🩸",
};

interface ChompSplash {
  id: string;
  x: number;
  y: number;
  color: string;
  text: string;
  createdAt: number;
}

export const ChumFrenzyOverlay: React.FC = () => {
  const { isActive, chumPieces, sharks, updateFrenzyState } = useChumStore();

  const [splashes, setSplashes] = useState<ChompSplash[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Cleanup splashes after 1.2s
  useEffect(() => {
    if (splashes.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setSplashes((prev) => prev.filter((s) => now - s.createdAt < 1200));
    }, 400);
    return () => clearTimeout(timer);
  }, [splashes]);

  const addChompSplash = useCallback((x: number, y: number, color: string) => {
    const texts = ["*CHOMP!*", "*NOM!*", "*GULP!*", "*MUNCH!*", "*CRUNCH!*", "*SLURP!*"];
    const text = texts[Math.floor(Math.random() * texts.length)];

    setSplashes((prev) => [
      ...prev.slice(-15),
      {
        id: `splash_${Date.now()}_${Math.random()}`,
        x,
        y,
        color,
        text,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  // Main 60fps simulation loop
  useEffect(() => {
    if (!isActive) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const loop = (currentTime: number) => {
      lastTimeRef.current = currentTime;

      updateFrenzyState((state) => {
        const { chumPieces: currentChum, sharks: currentSharks } = state;

        if (currentChum.length === 0 && currentSharks.length === 0) {
          return { isActive: false };
        }

        const screenH = window.innerHeight;
        const screenW = window.innerWidth;

        // 1. Update chum particles (slow, buoyant drifting with wide dispersion)
        const updatedChum: ChumPiece[] = [];
        for (const chum of currentChum) {
          if (chum.eaten) continue;

          // Water drag gently reduces burst velocity, while driftX maintains ongoing lateral spread
          const vx = chum.vx * 0.982;
          const targetMaxVy = chum.terminalVy || 0.68;
          const pieceGravity = chum.gravity || 0.014;
          const vy = Math.min(chum.vy * 0.98 + pieceGravity, targetMaxVy);
          const wobble = Math.sin(chum.wobbleOffset + currentTime * (chum.wobbleSpeed || 0.002)) * 0.7;

          // As pieces sink, they continually spread wider across the horizontal width
          const nx = chum.x + vx + (chum.driftX || 0) * 0.65 + wobble;
          const ny = chum.y + vy;
          const nRot = chum.rotation + chum.vRot;

          // Keep within reasonable bounds with soft bouncing off side edges
          let clampedX = nx;
          let newDriftX = chum.driftX;
          if (clampedX < 40) {
            clampedX = 40;
            newDriftX = Math.abs(newDriftX);
          } else if (clampedX > screenW - 40) {
            clampedX = screenW - 40;
            newDriftX = -Math.abs(newDriftX);
          }

          if (ny < screenH + 80) {
            updatedChum.push({
              ...chum,
              x: clampedX,
              y: ny,
              vx,
              vy,
              driftX: newDriftX,
              rotation: nRot,
            });
          }
        }

        // 2. Update sharks hunting AI (graceful predator stalking)
        const updatedSharks: FrenzyShark[] = [];
        const uneatenChum = updatedChum.filter((c) => !c.eaten);

        for (const shark of currentSharks) {
          let { x, y, angle, speed, maxSpeed, chompAnim, targetChumId } = shark;

          // Find target chum
          let targetChum = uneatenChum.find((c) => c.id === targetChumId);
          if (!targetChum && uneatenChum.length > 0) {
            // Find closest chum
            let closestDist = Infinity;
            let closest: ChumPiece | null = null;
            for (const c of uneatenChum) {
              const d = Math.hypot(c.x - x, c.y - y);
              if (d < closestDist) {
                closestDist = d;
                closest = c;
              }
            }
            if (closest) {
              targetChum = closest;
              targetChumId = closest.id;
            }
          }

          let targetAngle = angle;
          let desiredSpeed = speed;

          if (targetChum && !targetChum.eaten) {
            const dx = targetChum.x - x;
            const dy = targetChum.y - y;
            const dist = Math.hypot(dx, dy);

            targetAngle = Math.atan2(dy, dx);

            // Chomp distance threshold (~40px)
            if (dist < 42) {
              targetChum.eaten = true;
              chompAnim = 16;
              addChompSplash(targetChum.x, targetChum.y, shark.glowColor);
              desiredSpeed = maxSpeed * 1.25; // brief surge
            } else {
              desiredSpeed = Math.min(speed + 0.05, maxSpeed * 0.85); // calm cruising speed
            }
          } else {
            // No chum left: swim outward off-screen
            const exitLeft = x < screenW / 2;
            targetAngle = exitLeft ? Math.PI : 0;
            desiredSpeed = maxSpeed * 0.85;
          }

          // Smooth turning towards target angle with wide predator arcs
          let angleDiff = targetAngle - angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          angle += angleDiff * 0.045; // wide, graceful circling predator curves

          // Move forward along heading
          x += Math.cos(angle) * desiredSpeed;
          y += Math.sin(angle) * desiredSpeed;

          // Decay chomp animation
          if (chompAnim > 0) {
            chompAnim--;
          }

          // Keep shark alive if still on screen or chum exists
          const isOffScreen = x < -260 || x > screenW + 260 || y < -200 || y > screenH + 200;
          if (!isOffScreen || uneatenChum.length > 0) {
            updatedSharks.push({
              ...shark,
              x,
              y,
              angle,
              targetAngle,
              speed: desiredSpeed,
              chompAnim,
              targetChumId: targetChum?.eaten ? null : targetChumId,
              state: uneatenChum.length > 0 ? "hunting" : "departing",
            });
          }
        }

        return {
          chumPieces: updatedChum,
          sharks: updatedSharks,
          isActive: updatedChum.length > 0 || updatedSharks.length > 0,
        };
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isActive, updateFrenzyState, addChompSplash]);

  if (!isActive && splashes.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* 1. Sinking Chum Pieces */}
      {chumPieces.map((chum) => {
        if (chum.eaten) return null;
        return (
          <div
            key={chum.id}
            style={{
              transform: `translate3d(${chum.x - chum.size / 2}px, ${chum.y - chum.size / 2}px, 0) rotate(${chum.rotation}deg)`,
              width: `${chum.size}px`,
              height: `${chum.size}px`,
            }}
            className="absolute flex items-center justify-center transition-transform duration-75 will-change-transform drop-shadow-[0_4px_10px_rgba(239,68,68,0.5)]"
          >
            <span className="text-xl select-none leading-none filter drop-shadow">
              {CHUM_EMOJIS[chum.type] || "🐟"}
            </span>
          </div>
        );
      })}

      {/* 2. Swimming Frenzy Sharks */}
      {sharks.map((shark) => {
        const isFlipped = Math.abs(shark.angle) > Math.PI / 2;
        const displayAngle = shark.angle * (180 / Math.PI);

        return (
          <div
            key={shark.id}
            style={{
              transform: `translate3d(${shark.x - shark.size / 2}px, ${shark.y - (shark.size * 0.45)}px, 0) rotate(${displayAngle}deg) ${
                isFlipped ? "scaleY(-1)" : ""
              } ${shark.chompAnim > 0 ? "scale(1.15)" : ""}`,
              width: `${shark.size}px`,
              height: `${shark.size * 0.9}px`,
            }}
            className="absolute flex items-center justify-center pointer-events-none transition-transform duration-75 will-change-transform"
          >
            {/* Glowing predator trail */}
            <div
              style={{
                backgroundColor: shark.glowColor,
                boxShadow: `0 0 28px ${shark.glowColor}`,
              }}
              className="absolute w-12 h-12 rounded-full opacity-20 blur-xl pointer-events-none"
            />

            {/* Canonical GitShark Vector Model */}
            <GitSharkLogo
              size={shark.size}
              flipX={true}
              withBackground={false}
              withGlow={true}
              animated={true}
              glowColor={shark.glowColor}
              className={`drop-shadow-[0_10px_26px_rgba(14,165,233,0.65)] ${
                shark.chompAnim > 0 ? "brightness-125" : ""
              }`}
            />
          </div>
        );
      })}

      {/* 3. Chomp Shockwaves & Bite Splash Text */}
      {splashes.map((splash) => (
        <div
          key={splash.id}
          style={{
            left: `${splash.x}px`,
            top: `${splash.y}px`,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in-50 duration-200"
        >
          {/* Hydro-Shockwave Expanding Ring */}
          <div
            style={{ borderColor: splash.color }}
            className="w-16 h-16 rounded-full border-2 animate-ping opacity-80 shadow-[0_0_16px_rgba(56,189,248,0.8)]"
          />

          {/* Comic Bite Text */}
          <span
            style={{
              color: splash.color,
              textShadow: `0 0 10px ${splash.color}, 0 2px 4px rgba(0,0,0,0.8)`,
            }}
            className="absolute -top-6 text-xs font-black font-mono tracking-wider whitespace-nowrap animate-bounce"
          >
            {splash.text}
          </span>
        </div>
      ))}
    </div>
  );
};
