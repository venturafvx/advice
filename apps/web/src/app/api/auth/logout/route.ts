import { NextResponse } from "next/server";
import { COOKIE_SESSAO, opcoesCookieExpirado } from "@/lib/auth/sessao";

export const runtime = "nodejs";

/**
 * POST (não GET) de propósito: sair é uma ação com efeito, e um `GET`
 * de logout é derrubável por um `<img src="/api/auth/logout">` em
 * qualquer página. Como toda rota mutante, passa pela checagem de
 * Origin do middleware.
 *
 * A sessão é um JWT sem estado no servidor, então "sair" é apagar o
 * cookie. Revogação antes do `exp` exigiria guardar sessão no banco —
 * peso que só se paga quando há mais de um operador e mais de um
 * dispositivo. Para forçar a queda de todas as sessões hoje, basta
 * trocar `AUTH_SESSION_SECRET` e redeployar.
 */
export async function POST(): Promise<NextResponse> {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO, "", opcoesCookieExpirado());
  return resposta;
}
