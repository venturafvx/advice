import { NextResponse } from "next/server";
import { cancelarLembrete, LembreteNaoEncontradoError } from "@advice/application";
import { TransicaoInvalidaError } from "@advice/domain";
import { lembreteRepository } from "@/lib/container";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

/**
 * Cancelar é uma transição de estado, não a remoção de um recurso — por
 * isso POST numa ação nomeada, e não o DELETE do lembrete (que apaga
 * mesmo). Numa série, é assim que a repetição termina.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await context.params;

  try {
    await cancelarLembrete(id, { lembreteRepository });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    if (erro instanceof LembreteNaoEncontradoError) {
      return NextResponse.json({ erro: erro.message }, { status: 404 });
    }
    if (erro instanceof TransicaoInvalidaError) {
      return NextResponse.json({ erro: erro.message }, { status: 409 });
    }
    console.error("[api/lembretes/[id]/cancelar] erro inesperado ao cancelar lembrete:", erro);
    return NextResponse.json({ erro: "Erro interno ao cancelar o lembrete" }, { status: 500 });
  }
}
