import { NextResponse } from "next/server";
import { arquivarCategoriaDeCusto, atualizarCategoriaDeCusto } from "@advice/application";
import { categoriaRepository } from "@/lib/container";
import { arquivamentoSchema, categoriaSchema } from "@/lib/operacao-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = categoriaSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const categoria = await atualizarCategoriaDeCusto(
      id,
      { ...resultado.data, valorPadrao: resultado.data.valorPadrao ?? null },
      { categoriaRepository },
    );
    return NextResponse.json({ categoria });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/categorias/[id]");
  }
}

/**
 * Arquivar e reativar, nunca excluir: há operações apontando para a
 * categoria, e o histórico financeiro não pode perder o rótulo do que
 * foi gasto. Por isso não existe DELETE nesta rota.
 */
export async function PATCH(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = arquivamentoSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const categoria = await arquivarCategoriaDeCusto(id, resultado.data.arquivada, { categoriaRepository });
    return NextResponse.json({ categoria });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/categorias/[id]");
  }
}
