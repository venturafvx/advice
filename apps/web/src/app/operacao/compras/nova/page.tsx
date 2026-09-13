import type { Metadata } from "next";
import Link from "next/link";
import { listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { EditorDeCompra } from "@/components/operacao/EditorDeCompra";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nova compra · Venturax",
};

export default async function NovaCompraPage() {
  await exigirSessao();

  const categorias = await listarCategoriasDeCusto({ categoriaRepository });

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href="/operacao">Operação</Link> · Nova compra
        </p>
        <h1>Registrar uma compra</h1>
        <p>Preencha e veja a margem se formar ao lado, em tempo real.</p>
      </header>

      <EditorDeCompra categoriasIniciais={categorias} />
    </main>
  );
}
