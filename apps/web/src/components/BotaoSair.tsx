"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair(): Promise<void> {
    setSaindo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setSaindo(false);
    }
  }

  return (
    <button type="button" className="link-discreto" onClick={sair} disabled={saindo}>
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
