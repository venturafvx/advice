import Link from "next/link";
import { PERIODOS, type ChaveDePeriodo } from "@/lib/periodo";

/**
 * O recorte temporal, como links. `base` existe porque o mesmo filtro
 * serve a visão geral e ao painel de cada negócio — o período tem de
 * sobreviver à troca de tela, e é a URL que o carrega.
 */
export function FiltroDePeriodo({ base, periodo }: { base: string; periodo: ChaveDePeriodo }) {
  return (
    <nav className="filtro-periodo" aria-label="Período">
      {PERIODOS.map(({ chave, rotulo }) => (
        <Link
          key={chave}
          href={`${base}?periodo=${chave}`}
          className={chave === periodo ? "ativo" : ""}
          aria-current={chave === periodo ? "page" : undefined}
        >
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}
