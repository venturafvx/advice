import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import {
  CategoriaDeCustoDuplicadaError,
  CategoriaDeCustoNaoEncontradaError,
  CompraNaoEncontradaError,
  ServicoNaoEncontradoError,
} from "@advice/application";
import { DomainError } from "@advice/domain";

export function erroDeValidacao(erro: ZodError): NextResponse {
  return NextResponse.json({ erro: erro.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
}

/**
 * Traduz erro de aplicação/domínio em status HTTP num lugar só.
 *
 * Só o 500 loga e some com a mensagem: erro inesperado pode carregar
 * detalhe de infraestrutura (host do banco, stack) e não tem por que
 * atravessar para o cliente. Os demais são erros de negócio — a
 * mensagem é a informação útil.
 */
export function erroDeOperacao(erro: unknown, contexto: string): NextResponse {
  if (
    erro instanceof CompraNaoEncontradaError ||
    erro instanceof ServicoNaoEncontradoError ||
    erro instanceof CategoriaDeCustoNaoEncontradaError
  ) {
    return NextResponse.json({ erro: erro.message }, { status: 404 });
  }
  if (erro instanceof CategoriaDeCustoDuplicadaError) {
    return NextResponse.json({ erro: erro.message }, { status: 409 });
  }
  if (erro instanceof DomainError) {
    return NextResponse.json({ erro: erro.message }, { status: 422 });
  }

  console.error(`[${contexto}] erro inesperado:`, erro);
  return NextResponse.json({ erro: "Erro interno ao processar a operação" }, { status: 500 });
}
