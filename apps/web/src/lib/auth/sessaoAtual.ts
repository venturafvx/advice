import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { COOKIE_SESSAO, lerSessao, type Sessao } from "./sessao";

/**
 * A autorização de verdade — a que não depende de nenhum matcher estar
 * escrito certo. Toda página e toda rota de API leem a sessão daqui.
 *
 * `cache()` do React deduplica por requisição: chamar em três lugares
 * durante o mesmo render verifica o JWT uma vez só.
 */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const cookieStore = await cookies();
  return lerSessao(cookieStore.get(COOKIE_SESSAO)?.value);
});

/**
 * Para páginas: sem sessão, manda para o login em vez de renderizar.
 * `redirect()` lança, então o retorno já vem estreitado — quem chama
 * segue com uma Sessao de verdade.
 */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  return sessao;
}

/** Resposta padrão de rota de API sem sessão válida. */
export function respostaNaoAutenticado(): NextResponse {
  return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
}
