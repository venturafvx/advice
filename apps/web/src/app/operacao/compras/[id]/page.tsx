import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCompra, listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository, compraRepository } from "@/lib/container";
import { EditorDeCompra } from "@/components/operacao/EditorDeCompra";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compra · Venturax",
};

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao();

  const { id } = await params;

  const [compra, categorias] = await Promise.all([
    buscarCompra(id, { compraRepository }),
    listarCategoriasDeCusto({ categoriaRepository }, true),
  ]);

  if (!compra) {
    notFound();
  }

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href="/operacao">Operação</Link> · Compra
        </p>
        <h1>{compra.descricao}</h1>
        <p>Ajuste o que mudou — taxa real, frete que veio diferente — e a margem se refaz na hora.</p>
      </header>

      <EditorDeCompra categoriasIniciais={categorias} compra={compra} />
    </main>
  );
}
