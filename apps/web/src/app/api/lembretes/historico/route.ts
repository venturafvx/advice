import { NextResponse } from "next/server";
import { limparHistorico } from "@advice/application";
import { lembreteRepository } from "@/lib/container";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

/**
 * Apaga o histórico inteiro — todos os lembretes em estado terminal e
 * os envios deles. Irreversível, e por isso a tela pede confirmação
 * explícita antes de chegar aqui.
 *
 * Segmento estático, então nunca colide com `[id]`: um id é UUID e
 * "historico" não é um.
 */
export async function DELETE() {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  try {
    const apagados = await limparHistorico({ lembreteRepository });
    return NextResponse.json({ apagados });
  } catch (erro) {
    console.error("[api/lembretes/historico] erro inesperado ao limpar histórico:", erro);
    return NextResponse.json({ erro: "Erro interno ao limpar o histórico" }, { status: 500 });
  }
}
