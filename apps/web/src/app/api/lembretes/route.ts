import { NextResponse } from "next/server";
import { criarLembrete, listarHistorico, listarPendentes } from "@advice/application";
import { DomainError } from "@advice/domain";
import { lembreteRepository } from "@/lib/container";
import { buscaSchema, lembreteSchema, paraInputDeLembrete } from "@/lib/lembrete-schemas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  // Busca inválida (longa demais) não é erro de uso — é dedo pesado.
  // Ignorar o termo devolve a lista completa, que é o pior que pode
  // acontecer, em vez de uma tela de erro por causa de uma digitação.
  const busca = buscaSchema.safeParse(new URL(request.url).searchParams.get("busca") ?? "");
  const termo = busca.success ? busca.data : undefined;

  const [pendentes, historico] = await Promise.all([
    listarPendentes({ lembreteRepository }, termo),
    listarHistorico({ lembreteRepository }, termo),
  ]);

  return NextResponse.json({ pendentes, historico });
}

export async function POST(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const corpo = await request.json().catch(() => null);
  const resultado = lembreteSchema.safeParse(corpo);

  if (!resultado.success) {
    return NextResponse.json(
      { erro: resultado.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  try {
    const { id, agendadoPara } = await criarLembrete(paraInputDeLembrete(resultado.data), {
      lembreteRepository,
    });
    return NextResponse.json({ id, agendadoPara: agendadoPara.toISOString() }, { status: 201 });
  } catch (erro) {
    if (erro instanceof DomainError) {
      return NextResponse.json({ erro: erro.message }, { status: 422 });
    }
    console.error("[api/lembretes] erro inesperado ao criar lembrete:", erro);
    return NextResponse.json({ erro: "Erro interno ao criar o lembrete" }, { status: 500 });
  }
}
