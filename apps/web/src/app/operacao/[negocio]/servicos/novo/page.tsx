import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { EditorDeServico } from "@/components/operacao/EditorDeServico";
import { caminhoDoNegocio, perfilPorSlug } from "@/lib/negocios";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Novo serviço · Operação",
};

export default async function NovoServicoPage({ params }: { params: Promise<{ negocio: string }> }) {
  await exigirSessao();

  const perfil = perfilPorSlug((await params).negocio);
  if (!perfil) {
    notFound();
  }

  const categorias = await listarCategoriasDeCusto({ categoriaRepository });

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href={caminhoDoNegocio(perfil)}>{perfil.nome}</Link> · Novo serviço
        </p>
        <h1>Registrar um serviço</h1>
        <p>O que entrou, e o que saiu para entregar.</p>
      </header>

      <EditorDeServico categoriasIniciais={categorias} perfil={perfil} />
    </main>
  );
}
