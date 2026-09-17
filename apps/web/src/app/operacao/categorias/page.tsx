import type { Metadata } from "next";
import Link from "next/link";
import { listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { GerenciadorDeCategorias } from "@/components/operacao/GerenciadorDeCategorias";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tipos de custo · Operação",
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
          Os custos que incidem nas suas operações. Cada um guarda como costuma incidir — fixo, por unidade
          ou percentual da venda — e já chega preenchido no formulário. A lista é <strong>compartilhada
          pelos dois negócios</strong>: &quot;Frete&quot; é frete nos dois, e é o que permite comparar para
          onde o custo vai em cada um.
        </p>
      </header>

      <GerenciadorDeCategorias categoriasIniciais={categorias} />
    </main>
  );
}
