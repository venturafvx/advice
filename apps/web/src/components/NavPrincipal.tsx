"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotaoSair } from "./BotaoSair";

const SECOES = [
  { href: "/", rotulo: "Lembretes" },
  { href: "/operacao", rotulo: "Operação" },
];

/** A tela de login não tem chrome: não há sessão nem para onde navegar. */
const SEM_BARRA = new Set(["/login"]);

export function NavPrincipal() {
  const caminho = usePathname();

  if (SEM_BARRA.has(caminho)) {
    return null;
  }

  return (
    <header className="barra-topo">
      <div className="barra-topo-conteudo">
        <Link href="/" className="marca">
          Venturax
        </Link>
        <nav aria-label="Seções">
          {SECOES.map((secao) => {
            const ativa = secao.href === "/" ? caminho === "/" : caminho.startsWith(secao.href);
            return (
              <Link
                key={secao.href}
                href={secao.href}
                className={ativa ? "ativo" : ""}
                aria-current={ativa ? "page" : undefined}
              >
                {secao.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="barra-topo-fim">
          <BotaoSair />
        </div>
      </div>
    </header>
  );
}
