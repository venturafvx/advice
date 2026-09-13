import { NextResponse } from "next/server";
import { atualizarCompra, buscarCompra, excluirCompra } from "@advice/application";
import { categoriaRepository, compraRepository } from "@/lib/container";
import { compraSchema } from "@/lib/operacao-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;

  try {
    const compra = await buscarCompra(id, { compraRepository });
    if (!compra) {
      return NextResponse.json({ erro: "Compra não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ compra });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/compras/[id]");
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;
  const corpo = await request.json().catch(() => null);
  const resultado = compraSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const compra = await atualizarCompra(id, resultado.data, { compraRepository, categoriaRepository });
    return NextResponse.json({ compra });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/compras/[id]");
  }
}

export async function DELETE(_request: Request, contexto: Contexto) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const { id } = await contexto.params;

  try {
    await excluirCompra(id, { compraRepository });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/compras/[id]");
  }
}
