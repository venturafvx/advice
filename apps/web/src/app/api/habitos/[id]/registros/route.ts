import { NextResponse } from "next/server";
import { apagarRegistroDoDia, registrarDia } from "@advice/application";
import { habitoRepository, registroRepository } from "@/lib/container";
import { diaSchema, paraInputDeRegistro, registroDoDiaSchema } from "@/lib/habito-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

/**
 * Declara o que aconteceu num dia — ou corrige o que já foi declarado.
 *
 * PUT, não POST: o recurso é "o dia", existe no máximo um por hábito, e
 * mandar duas vezes o mesmo corpo tem de dar o mesmo resultado. É o
 * verbo que combina com o upsert por (hábito, dia) lá embaixo.
 */
export async function PUT(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = registroDoDiaSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const registro = await registrarDia(id, paraInputDeRegistro(resultado.data), {
      habitoRepository,
      registroRepository,
    });
    return NextResponse.json(registro);
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos/[id]/registros");
  }
}

/** Desfaz o registro do dia: o tique errado, ou a quebra que não era. */
export async function DELETE(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const dia = diaSchema.safeParse(new URL(request.url).searchParams.get("dia") ?? "");

  if (!dia.success) {
    return erroDeValidacao(dia.error);
  }

  try {
    const apagado = await apagarRegistroDoDia(id, dia.data, { registroRepository });
    return NextResponse.json({ apagado });
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos/[id]/registros");
  }
}
