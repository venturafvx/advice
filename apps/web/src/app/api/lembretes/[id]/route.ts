import { NextResponse } from "next/server";
import { editarLembrete, excluirLembrete, LembreteNaoEncontradoError } from "@advice/application";
import { DomainError, LembreteImutavelError } from "@advice/domain";
import { lembreteRepository } from "@/lib/container";
import { lembreteSchema, paraInputDeLembrete } from "@/lib/lembrete-schemas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

/**
 * Editar um lembrete pendente: título e quando ele dispara.
 *
 * PATCH e não PUT porque o corpo não descreve o recurso inteiro — id,
 * status e criação não são do chamador e nunca foram.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await context.params;
  const corpo = await request.json().catch(() => null);
  const resultado = lembreteSchema.safeParse(corpo);

  if (!resultado.success) {
    return NextResponse.json(
      { erro: resultado.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  try {
    const editado = await editarLembrete(id, paraInputDeLembrete(resultado.data), { lembreteRepository });
    return NextResponse.json({ id: editado.id, agendadoPara: editado.agendadoPara.toISOString() });
  } catch (erro) {
    return respostaDeErro(erro, "editar");
  }
}

/**
 * Apaga o lembrete de vez — ele e os envios que produziu.
 *
 * Note que DELETE aqui é *apagar*, não cancelar: cancelar preserva o
 * registro e mora em `POST .../cancelar`. São duas intenções diferentes
 * e nenhuma das duas deveria se disfarçar da outra.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await context.params;

  try {
    await excluirLembrete(id, { lembreteRepository });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro, "excluir");
  }
}

function respostaDeErro(erro: unknown, acao: string): NextResponse {
  if (erro instanceof LembreteNaoEncontradoError) {
    return NextResponse.json({ erro: erro.message }, { status: 404 });
  }
  if (erro instanceof LembreteImutavelError) {
    return NextResponse.json({ erro: erro.message }, { status: 409 });
  }
  if (erro instanceof DomainError) {
    return NextResponse.json({ erro: erro.message }, { status: 422 });
  }

  console.error(`[api/lembretes/[id]] erro inesperado ao ${acao} lembrete:`, erro);
  return NextResponse.json({ erro: `Erro interno ao ${acao} o lembrete` }, { status: 500 });
}
