"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/ui/switch";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <img src="/sun.svg" alt="Light" width={16} height={16} className="dark:opacity-40" />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => {
          setIsDark(checked);
          document.documentElement.classList.toggle("dark", checked);
          localStorage.setItem("theme", checked ? "dark" : "light");
        }}
      />
      <img src="/moon.svg" alt="Dark" width={16} height={16} className="opacity-40 dark:opacity-100" />
    </div>
  );
}
