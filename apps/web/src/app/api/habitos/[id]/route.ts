import { NextResponse } from "next/server";
import { definirArquivamento, editarHabito, excluirHabito } from "@advice/application";
import { habitoRepository } from "@/lib/container";
import { arquivamentoSchema, habitoSchema, paraInputDeHabito } from "@/lib/habito-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

/** Editar o hábito: nome, regra e motivação. Vale daqui para a frente — não reescreve o passado. */
export async function PUT(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = habitoSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    return NextResponse.json(await editarHabito(id, paraInputDeHabito(resultado.data), { habitoRepository }));
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos/[id]");
  }
}

/** Arquivar e reativar — o caminho normal para "parei com esse". */
export async function PATCH(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = arquivamentoSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    return NextResponse.json(await definirArquivamento(id, resultado.data.arquivado, { habitoRepository }));
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos/[id]");
  }
}

/**
 * Apaga o hábito e todo o histórico dele, sem volta.
 *
 * DELETE aqui é *apagar*, não arquivar — são dois verbos e nenhum se
 * disfarça do outro, mesma regra dos lembretes. É para o hábito criado
 * por engano; quem parou com um hábito real usa o PATCH acima.
 */
export async function DELETE(_request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;

  try {
    await excluirHabito(id, { habitoRepository });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos/[id]");
  }
}
