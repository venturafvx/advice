import { NextResponse } from "next/server";
import { atualizarServico, buscarServico, excluirServico } from "@advice/application";
import { categoriaRepository, servicoRepository } from "@/lib/container";
import { servicoSchema } from "@/lib/operacao-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;

  try {
    const servico = await buscarServico(id, { servicoRepository });
    if (!servico) {
      return NextResponse.json({ erro: "Serviço não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ servico });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/servicos/[id]");
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = servicoSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const servico = await atualizarServico(id, resultado.data, { servicoRepository, categoriaRepository });
    return NextResponse.json({ servico });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/servicos/[id]");
  }
}

export async function DELETE(_request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;

  try {
    await excluirServico(id, { servicoRepository });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/servicos/[id]");
  }
}
