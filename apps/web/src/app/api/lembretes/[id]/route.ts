import { NextResponse } from "next/server";
import { cancelarLembrete, LembreteNaoEncontradoError } from "@advice/application";
import { TransicaoInvalidaError } from "@advice/domain";
import { lembreteRepository } from "@/lib/container";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    console.error("[api/lembretes/[id]] erro inesperado ao cancelar lembrete:", erro);
    return NextResponse.json({ erro: "Erro interno ao cancelar o lembrete" }, { status: 500 });
  }
}
