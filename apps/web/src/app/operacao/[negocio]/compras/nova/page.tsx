import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { EditorDeCompra } from "@/components/operacao/EditorDeCompra";
import { caminhoDoNegocio, perfilPorSlug } from "@/lib/negocios";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nova compra · Operação",
};

export default async function NovaCompraPage({ params }: { params: Promise<{ negocio: string }> }) {
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
          <Link href={caminhoDoNegocio(perfil)}>{perfil.nome}</Link> · Nova compra
        </p>
        <h1>Registrar uma compra</h1>
        <p>Preencha e veja a margem se formar ao lado, em tempo real.</p>
      </header>

      <EditorDeCompra categoriasIniciais={categorias} perfil={perfil} />
    </main>
  );
}
