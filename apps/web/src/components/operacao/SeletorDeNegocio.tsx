import Link from "next/link";
import { caminhoDoNegocio, PERFIS_LISTA, type PerfilDeNegocio } from "@/lib/negocios";
import type { ChaveDePeriodo } from "@/lib/periodo";

/**
 * A troca de negócio. É a decisão mais frequente dentro de Operação —
 * "qual dos dois estou olhando" — então ela mora no topo, sempre
 * visível, e não escondida num menu. Links, não estado de cliente: o
 * painel inteiro é renderizado no servidor e o período viaja junto para
 * não se perder na troca.
 */
export function SeletorDeNegocio({
  ativo,
  periodo,
}: {
  ativo: PerfilDeNegocio | null;
  periodo: ChaveDePeriodo;
}) {
  const query = `?periodo=${periodo}`;

  return (
    <nav className="seletor-negocio" aria-label="Negócio">
      <Link
        href={`/operacao${query}`}
        className={ativo === null ? "ativo" : ""}
        aria-current={ativo === null ? "page" : undefined}
      >
        Visão geral
      </Link>
      {PERFIS_LISTA.map((perfil) => {
        const selecionado = ativo?.negocio === perfil.negocio;
        return (
          <Link
            key={perfil.slug}
            href={`${caminhoDoNegocio(perfil)}${query}`}
            className={selecionado ? "ativo" : ""}
            aria-current={selecionado ? "page" : undefined}
          >
            {perfil.nome}
          </Link>
        );
      })}
    </nav>
  );
}
