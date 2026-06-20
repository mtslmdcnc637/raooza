"use client";

import { useEffect, useState } from "react";
import { BootScreen } from "@/components/desktop/BootScreen";
import { LoginScreen } from "@/components/desktop/LoginScreen";
import { Desktop } from "@/components/desktop/Desktop";
import { useSettings } from "@/stores/settingsStore";

export default function Home() {
  const booted = useSettings((s) => s.booted);
  const hydrate = useSettings((s) => s.hydrate);
  const mode = useSettings((s) => s.mode);
  const [loggedIn, setLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  // Apply theme to <html>
  useEffect(() => {
    if (mode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [mode]);

  if (!hydrated) {
    return <div className="fixed inset-0 bg-black" />;
  }

  if (!booted) return <BootScreen />;
  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  return <Desktop />;
}
