import { NextResponse } from "next/server";
import { listarCompras, registrarCompra } from "@advice/application";
import { categoriaRepository, compraRepository } from "@/lib/container";
import { compraSchema, lerFiltroPeriodo } from "@/lib/operacao-schemas";
import { erroDeOperacao, erroDeValidacao } from "@/lib/respostas";
import { respostaNaoAutenticado, sessaoAtual } from "@/lib/auth/sessaoAtual";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const compras = await listarCompras({ compraRepository }, lerFiltroPeriodo(new URL(request.url)));
  return NextResponse.json({ compras });
}

export async function POST(request: Request) {
  if (!(await sessaoAtual())) return respostaNaoAutenticado();

  const corpo = await request.json().catch(() => null);
  const resultado = compraSchema.safeParse(corpo);

  if (!resultado.success) {
    return erroDeValidacao(resultado.error);
  }

  try {
    const compra = await registrarCompra(resultado.data, { compraRepository, categoriaRepository });
    return NextResponse.json({ compra }, { status: 201 });
  } catch (erro) {
    return erroDeOperacao(erro, "api/operacao/compras");
  }
}
