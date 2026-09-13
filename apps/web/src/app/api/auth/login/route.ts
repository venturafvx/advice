import { NextResponse } from "next/server";
import { z } from "zod";
import { credenciaisConferem, emailDoOperador } from "@/lib/auth/credenciais";
import { ipDaRequisicao, limitadorGlobal, limitadorPorIp } from "@/lib/auth/limitador";
import { COOKIE_SESSAO, emitirSessao, opcoesCookieSessao } from "@/lib/auth/sessao";

export const runtime = "nodejs";

/**
 * Uma mensagem só para e-mail errado, senha errada e corpo inválido.
 * Distinguir os casos entregaria de graça a metade da credencial.
 */
const CREDENCIAL_INVALIDA = "E-mail ou senha inválidos";

const loginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  // O teto existe só para não deixar a CPU do scrypt à mercê do corpo
  // da requisição; nenhuma senha real chega perto disso.
  senha: z.string().min(1).max(1024),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = ipDaRequisicao(request);

  const porIp = limitadorPorIp.consumir(ip);
  const global = limitadorGlobal.consumir("global");

  if (!porIp.permitido || !global.permitido) {
    const esperar = Math.max(porIp.esperarSegundos, global.esperarSegundos, 1);
    console.warn(`[auth] tentativas demais de ${ip} — bloqueado por ${esperar}s`);
    return NextResponse.json(
      { erro: "Tentativas demais. Aguarde alguns minutos e tente de novo." },
      { status: 429, headers: { "Retry-After": String(esperar) } },
    );
  }

  const corpo = await request.json().catch(() => null);
  const resultado = loginSchema.safeParse(corpo);

  if (!resultado.success) {
    return NextResponse.json({ erro: CREDENCIAL_INVALIDA }, { status: 401 });
  }

  const confere = await credenciaisConferem(resultado.data.email, resultado.data.senha);

  if (!confere) {
    console.warn(`[auth] login recusado (ip=${ip})`);
    return NextResponse.json({ erro: CREDENCIAL_INVALIDA }, { status: 401 });
  }

  limitadorPorIp.liberar(ip);
  console.log(`[auth] login aceito (ip=${ip})`);

  const resposta = NextResponse.json({ ok: true });
  // O `sub` vem da configuração, não do que foi digitado.
  resposta.cookies.set(COOKIE_SESSAO, await emitirSessao(emailDoOperador()), opcoesCookieSessao());
  return resposta;
}
