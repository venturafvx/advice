import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCompra, listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository, compraRepository } from "@/lib/container";
import { EditorDeCompra } from "@/components/operacao/EditorDeCompra";
import { caminhoDoNegocio, perfilPorSlug } from "@/lib/negocios";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compra · Operação",
};

export default async function CompraPage({
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

  const [compra, categorias] = await Promise.all([
    buscarCompra(id, { compraRepository }),
    listarCategoriasDeCusto({ categoriaRepository }, true),
  ]);

  // A compra tem de existir **e** ser deste negócio: sem a segunda
  // checagem, trocar o slug na URL abriria o lançamento do outro
  // negócio numa tela que diz pertencer a este.
  if (!compra || compra.negocio !== perfil.negocio) {
    notFound();
  }

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href={caminhoDoNegocio(perfil)}>{perfil.nome}</Link> · Compra
        </p>
        <h1>{compra.descricao}</h1>
        <p>Ajuste o que mudou — taxa real, frete que veio diferente — e a margem se refaz na hora.</p>
      </header>

      <EditorDeCompra categoriasIniciais={categorias} perfil={perfil} compra={compra} />
    </main>
  );
}
