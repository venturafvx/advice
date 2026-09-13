import type { Metadata } from "next";
import Link from "next/link";
import { listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { GerenciadorDeCategorias } from "@/components/operacao/GerenciadorDeCategorias";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tipos de custo · Venturax",
};

export default async function CategoriasPage() {
  await exigirSessao();

  const categorias = await listarCategoriasDeCusto({ categoriaRepository }, true);

  return (
    <main>
      <header className="cabecalho">
        <p className="selo">
          <Link href="/operacao">Operação</Link> · Tipos de custo
        </p>
        <h1>Tipos de custo</h1>
        <p>
          Os custos que incidem na sua operação. Cada um guarda como costuma incidir — fixo, por unidade ou
          percentual da venda — e já chega preenchido no formulário.
        </p>
      </header>

      <GerenciadorDeCategorias categoriasIniciais={categorias} />
    </main>
  );
}
