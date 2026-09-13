import { NextResponse } from "next/server";
import { listarServicos, registrarServico } from "@advice/application";
import { categoriaRepository, servicoRepository } from "@/lib/container";
import { lerFiltroPeriodo, servicoSchema } from "@/lib/operacao-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const servicos = await listarServicos({ servicoRepository }, lerFiltroPeriodo(new URL(request.url)));
  return NextResponse.json({ servicos });
}

export async function POST(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const corpo = await request.json().catch(() => null);
  const resultado = servicoSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const servico = await registrarServico(resultado.data, { servicoRepository, categoriaRepository });
    return NextResponse.json({ servico }, { status: 201 });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/servicos");
  }
}
