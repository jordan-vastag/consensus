"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GIF_DURATION_MS = 2130;

export function Logo({ autoPlay = false, onClick }) {
  const [src, setSrc] = useState("/circle-diagram.png");
  const timerRef = useRef(null);

  const playGif = useCallback(() => {
    clearTimeout(timerRef.current);
    setSrc(`/circle-diagram.gif?t=${Date.now()}`);
    timerRef.current = setTimeout(() => {
      setSrc("/circle-diagram.png");
    }, GIF_DURATION_MS);
  }, []);

  useEffect(() => {
    if (autoPlay) {
      const t = setTimeout(playGif, 300);
      return () => {
        clearTimeout(t);
        clearTimeout(timerRef.current);
      };
    }
    return () => clearTimeout(timerRef.current);
  }, [autoPlay, playGif]);

  return (
    <div
      className={`flex items-center${onClick ? " cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt="Logo"
        loading="eager"
        onMouseEnter={playGif}
        className="w-20 h-20 sm:w-[150px] sm:h-[150px]"
      />
      <h1 className="text-4xl sm:text-7xl font-bold">Consensus</h1>
    </div>
  );
}
