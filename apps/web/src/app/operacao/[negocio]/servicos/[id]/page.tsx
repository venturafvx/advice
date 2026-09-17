import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarServico, listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository, servicoRepository } from "@/lib/container";
import { EditorDeServico } from "@/components/operacao/EditorDeServico";
import { caminhoDoNegocio, perfilPorSlug } from "@/lib/negocios";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Serviço · Operação",
};

export default async function ServicoPage({
  params,
}: {
  params: Promise<{ negocio: string; id: string }>;
}) {
  await exigirSessao();

  const { negocio, id } = await params;
  const perfil = perfilPorSlug(negocio);
  if (!perfil) {
    notFound();
  }

  const [servico, categorias] = await Promise.all([
    buscarServico(id, { servicoRepository }),
    listarCategoriasDeCusto({ categoriaRepository }, true),
  ]);

  if (!servico || servico.negocio !== perfil.negocio) {
    notFound();
  }

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href={caminhoDoNegocio(perfil)}>{perfil.nome}</Link> · Serviço
        </p>
        <h1>{servico.descricao}</h1>
        <p>O que foi recebido e o que custou entregar.</p>
      </header>

      <EditorDeServico categoriasIniciais={categorias} perfil={perfil} servico={servico} />
    </main>
  );
}
