import type { Metadata } from "next";
import Link from "next/link";
import { resumirOperacao } from "@advice/application";
import { compraRepository, servicoRepository } from "@/lib/container";
import { PainelOperacao } from "@/components/operacao/PainelOperacao";
import { lerChaveDePeriodo, resolverPeriodo } from "@/lib/periodo";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operação · Venturax",
  description: "Compras, custos e margem da operação Venturax",
};

export default async function OperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await exigirSessao();

  const { periodo } = await searchParams;
  const chave = lerChaveDePeriodo(periodo);
  const resumo = await resumirOperacao({ compraRepository, servicoRepository }, resolverPeriodo(chave));

  return (
    <main className="amplo">
      <header className="cabecalho cabecalho-com-acoes">
        <div>
          <p className="selo">Venturax · Operação</p>
          <h1>Como está a operação</h1>
          <p>Quanto custou, por quanto sai, e o que sobra de verdade no fim.</p>
        </div>
        <div className="acoes-cabecalho">
          <Link href="/operacao/compras/nova" className="botao botao-primario compacto">
            Registrar compra
          </Link>
          <Link href="/operacao/servicos/novo" className="botao botao-secundario">
            Registrar serviço
          </Link>
        </div>
      </header>

      <PainelOperacao resumo={resumo} periodo={chave} />

      <p className="rodape-sutil">
        <Link href="/operacao/categorias">Gerenciar tipos de custo</Link>
      </p>
    </main>
  );
}
