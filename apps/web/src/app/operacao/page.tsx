import type { Metadata } from "next";
import Link from "next/link";
import { resumirPorNegocio } from "@advice/application";
import { compraRepository, servicoRepository } from "@/lib/container";
import { SeletorDeNegocio } from "@/components/operacao/SeletorDeNegocio";
import { VisaoGeral } from "@/components/operacao/VisaoGeral";
import { lerChaveDePeriodo, resolverPeriodo } from "@/lib/periodo";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operação · Visão geral",
  description: "As duas operações lado a lado — Fabio Junior Decor e Venturax",
};

/**
 * A visão geral existe para uma pergunta só: como vão as duas operações
 * hoje. Ela mostra os dois negócios **lado a lado**, nunca somados —
 * margem média entre papel de parede e marketplace não descreve
 * nenhum dos dois. Para trabalhar de verdade, entra-se num deles.
 */
export default async function OperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await exigirSessao();

  const { periodo } = await searchParams;
  const chave = lerChaveDePeriodo(periodo);
  const resumos = await resumirPorNegocio(
    { compraRepository, servicoRepository },
    resolverPeriodo(chave),
  );

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">Operação</p>
        <h1>Suas duas operações</h1>
        <p>Cada negócio tem a sua economia. Aqui elas aparecem lado a lado — nunca somadas.</p>
      </header>

      <SeletorDeNegocio ativo={null} periodo={chave} />

      <VisaoGeral resumos={resumos} periodo={chave} />

      <p className="rodape-sutil">
        <Link href="/operacao/categorias">Gerenciar tipos de custo</Link> — compartilhados pelos dois
        negócios.
      </p>
    </main>
  );
}
