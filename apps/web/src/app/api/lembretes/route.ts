import { NextResponse } from "next/server";
import { z } from "zod";
import { criarLembrete, listarLembretes } from "@advice/application";
import { DomainError } from "@advice/domain";
import { lembreteRepository } from "@/lib/container";

export const runtime = "nodejs";

const criarLembreteSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o que você quer lembrar").max(200),
  agendadoPara: z.iso.datetime({ local: true }),
});

export async function GET() {
  const lembretes = await listarLembretes({ lembreteRepository });
  return NextResponse.json({ lembretes });
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const resultado = criarLembreteSchema.safeParse(corpo);

  if (!resultado.success) {
    return NextResponse.json({ erro: resultado.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  try {
    const { id } = await criarLembrete(
      { titulo: resultado.data.titulo, agendadoPara: new Date(resultado.data.agendadoPara) },
      { lembreteRepository },
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (erro) {
    if (erro instanceof DomainError) {
      return NextResponse.json({ erro: erro.message }, { status: 422 });
    }
    console.error("[api/lembretes] erro inesperado ao criar lembrete:", erro);
    return NextResponse.json({ erro: "Erro interno ao criar o lembrete" }, { status: 500 });
  }
}
