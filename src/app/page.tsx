"use client";

import { useEffect, useState } from "react";
import { BootScreen } from "@/components/desktop/BootScreen";
import { LoginScreen } from "@/components/desktop/LoginScreen";
import { Desktop } from "@/components/desktop/Desktop";
import { IntelBootOverlay } from "@/components/desktop/IntelBootOverlay";
import { useSettings } from "@/stores/settingsStore";

export default function Home() {
  const booted = useSettings((s) => s.booted);
  const hydrate = useSettings((s) => s.hydrate);
  const mode = useSettings((s) => s.mode);
  const showIntelOnBoot = useSettings((s) => s.showIntelOnBoot);
  const lastIntelAt = useSettings((s) => s.lastIntelAt);
  const [loggedIn, setLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showIntel, setShowIntel] = useState(false);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  // Apply theme to <html>
  useEffect(() => {
    if (mode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [mode]);

  // After login, if showIntelOnBoot is on AND intel is stale (>6h) or never fetched, show overlay
  useEffect(() => {
    if (loggedIn && showIntelOnBoot) {
      const stale = !lastIntelAt || (Date.now() - new Date(lastIntelAt).getTime() > 6 * 60 * 60 * 1000);
      if (stale) {
        setShowIntel(true);
      }
    }
  }, [loggedIn, showIntelOnBoot, lastIntelAt]);

  if (!hydrated) {
    return <div className="fixed inset-0 bg-black" />;
  }

  if (!booted) return <BootScreen />;
  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <>
      <Desktop />
      {showIntel && <IntelBootOverlay onDismiss={() => setShowIntel(false)} />}
    </>
  );
}
