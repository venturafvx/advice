import { NextResponse } from "next/server";
import { criarCategoriaDeCusto, listarCategoriasDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { categoriaSchema } from "@/lib/operacao-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const incluirArquivadas = new URL(request.url).searchParams.get("arquivadas") === "true";
  const categorias = await listarCategoriasDeCusto({ categoriaRepository }, incluirArquivadas);
  return NextResponse.json({ categorias });
}

export async function POST(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const corpo = await request.json().catch(() => null);
  const resultado = categoriaSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const categoria = await criarCategoriaDeCusto(
      { ...resultado.data, valorPadrao: resultado.data.valorPadrao ?? null },
      { categoriaRepository },
    );
    return NextResponse.json({ categoria }, { status: 201 });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/categorias");
  }
}
