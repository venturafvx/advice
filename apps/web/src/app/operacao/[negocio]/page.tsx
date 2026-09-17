import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resumirOperacao } from "@advice/application";
import { compraRepository, servicoRepository } from "@/lib/container";
import { PainelOperacao } from "@/components/operacao/PainelOperacao";
import { SeletorDeNegocio } from "@/components/operacao/SeletorDeNegocio";
import { caminhoDoNegocio, PERFIS_LISTA, perfilPorSlug } from "@/lib/negocios";
import { lerChaveDePeriodo, resolverPeriodo } from "@/lib/periodo";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

/** Só os dois slugs conhecidos existem — qualquer outro é 404. */
export function generateStaticParams() {
  return PERFIS_LISTA.map((perfil) => ({ negocio: perfil.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ negocio: string }>;
}): Promise<Metadata> {
  const perfil = perfilPorSlug((await params).negocio);
  return perfil
    ? { title: `Operação · ${perfil.nome}`, description: perfil.atividade }
    : { title: "Operação" };
}

export default async function PainelDoNegocioPage({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  await exigirSessao();

  const perfil = perfilPorSlug((await params).negocio);
  if (!perfil) {
    notFound();
  }

  const { periodo } = await searchParams;
  const chave = lerChaveDePeriodo(periodo);
  const resumo = await resumirOperacao(
    { compraRepository, servicoRepository },
    { ...resolverPeriodo(chave), negocio: perfil.negocio },
  );

  const base = caminhoDoNegocio(perfil);

  return (
    <main className="amplo">
      <header className="cabecalho cabecalho-com-acoes">
        <div>
          <p className="selo">{perfil.atividade}</p>
          <h1>{perfil.nome}</h1>
          <p>Quanto custou, por quanto sai, e o que sobra de verdade no fim.</p>
        </div>
        <div className="acoes-cabecalho">
          <Link href={`${base}/compras/nova`} className="botao botao-primario compacto">
            Registrar compra
          </Link>
          {perfil.temServicos ? (
            <Link href={`${base}/servicos/novo`} className="botao botao-secundario">
              Registrar serviço
            </Link>
          ) : null}
        </div>
      </header>

      <SeletorDeNegocio ativo={perfil} periodo={chave} />

      <PainelOperacao resumo={resumo} periodo={chave} perfil={perfil} />

      <p className="rodape-sutil">
        <Link href="/operacao/categorias">Gerenciar tipos de custo</Link>
      </p>
    </main>
  );
}
