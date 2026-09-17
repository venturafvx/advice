import { NextResponse } from "next/server";
import { criarHabito, montarPainelDeHabitos } from "@advice/application";
import { habitoRepository, registroRepository } from "@/lib/container";
import { habitoSchema, paraInputDeHabito } from "@/lib/habito-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

/**
 * O painel inteiro numa resposta.
 *
 * A tela recarrega isto depois de cada ação em vez de remendar o estado
 * local: sequência, aderência e faixa da semana mudam juntas a cada
 * tique, e recalcular só a linha tocada deixaria os outros números
 * defasados na mesma tela.
 */
export async function GET() {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  try {
    const painel = await montarPainelDeHabitos({ habitoRepository, registroRepository });
    return NextResponse.json(painel);
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos");
  }
}

export async function POST(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const corpo = await request.json().catch(() => null);
  const resultado = habitoSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const criado = await criarHabito(paraInputDeHabito(resultado.data), { habitoRepository });
    return NextResponse.json(criado, { status: 201 });
  } catch (erro) {
    return erroDeOperacao(erro, "api/habitos");
  }
}
