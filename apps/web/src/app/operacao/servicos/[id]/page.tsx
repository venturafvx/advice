import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarServico, listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository, servicoRepository } from "@/lib/container";
import { EditorDeServico } from "@/components/operacao/EditorDeServico";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Serviço · Venturax",
};

export default async function ServicoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao();

  const { id } = await params;

  const [servico, categorias] = await Promise.all([
    buscarServico(id, { servicoRepository }),
    listarCategoriasDeCusto({ categoriaRepository }, true),
  ]);

  if (!servico) {
    notFound();
  }

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href="/operacao">Operação</Link> · Serviço
        </p>
        <h1>{servico.descricao}</h1>
        <p>O que foi recebido e o que custou entregar.</p>
      </header>

      <EditorDeServico categoriasIniciais={categorias} servico={servico} />
    </main>
  );
}
