import type { Metadata } from "next";
import Link from "next/link";
import { listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { EditorDeServico } from "@/components/operacao/EditorDeServico";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Novo serviço · Venturax",
};

export default async function NovoServicoPage() {
  await exigirSessao();

  const categorias = await listarCategoriasDeCusto({ categoriaRepository });

  return (
    <main className="amplo">
      <header className="cabecalho">
        <p className="selo">
          <Link href="/operacao">Operação</Link> · Novo serviço
        </p>
        <h1>Registrar um serviço</h1>
        <p>Papel de parede e afins: o que entrou, o que saiu para entregar.</p>
      </header>

      <EditorDeServico categoriasIniciais={categorias} />
    </main>
  );
}
