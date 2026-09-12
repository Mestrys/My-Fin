"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "myfin:privacy-mode";

interface PrivacyModeContextValue {
  enabled: boolean;
  toggle: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

/**
 * "Modo Privacidade": aplica `filter: blur(8px)` sobre todo valor monetário
 * renderizado com o componente `<Money>` (via atributo `data-privacy` no
 * ancestral + regra CSS em globals.css). Estado é apenas uma preferência de
 * exibição do dispositivo — persistida em `localStorage`, nunca no banco.
 */
export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Lido apenas após montar (nunca no lazy initializer do useState): o
    // servidor sempre renderiza com `enabled=false` — ler localStorage
    // durante o render inicial do cliente divergiria do HTML hidratado.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage indisponível (modo privado, SSR de preview) — mantém padrão (desligado).
    }
  }, []);

  function toggle() {
    setEnabled((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignora falha de storage — a preferência só não persiste entre sessões.
      }
      return next;
    });
  }

  return (
    <PrivacyModeContext.Provider value={{ enabled, toggle }}>
      <div data-privacy={enabled ? "on" : "off"}>{children}</div>
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode(): PrivacyModeContextValue {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error("usePrivacyMode precisa estar dentro de <PrivacyModeProvider>.");
  }
  return context;
}
