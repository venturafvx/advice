import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_SESSAO,
  emitirSessao,
  lerSessao,
  opcoesCookieSessao,
  RENOVAR_QUANDO_FALTAR_SEGUNDOS,
} from "@/lib/auth/sessao";

/**
 * Porteiro da borda. No Next 16 este arquivo se chama `proxy.ts` (o
 * antigo `middleware.ts` foi renomeado) e roda no runtime Node por
 * padrão — declarar `runtime` aqui é erro de build.
 *
 * ELE NÃO É A AUTORIZAÇÃO. As próprias docs do Next avisam: um matcher
 * mal editado, ou uma rota que escape do padrão, remove a cobertura em
 * silêncio. Quem de fato autoriza é `sessaoAtual()` dentro de cada rota
 * e da página (`lib/auth/sessaoAtual.ts`). O proxy existe para três
 * coisas que só ele faz bem:
 *
 *   1. redirecionar para /login antes de renderizar (sem flash de tela);
 *   2. renovar o cookie de sessão de forma deslizante;
 *   3. barrar requisição mutante de origem estranha (CSRF).
 *
 * Duas camadas, e a de dentro basta sozinha.
 */

const ROTAS_PUBLICAS = new Set(["/login", "/api/auth/login"]);
const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // CSRF. O cookie é SameSite=Lax, o que já barra POST cross-site vindo
  // de navegador, mas isso é uma propriedade do cliente — a checagem de
  // Origin é a verificação que o servidor faz por conta própria. Vale
  // para toda rota mutante, inclusive o login (senão um site terceiro
  // poderia logar a vítima numa conta controlada por ele).
  if (!METODOS_SEGUROS.has(request.method) && !origemConfere(request)) {
    return NextResponse.json({ erro: "Origem não permitida" }, { status: 403 });
  }

  const sessao = await lerSessao(request.cookies.get(COOKIE_SESSAO)?.value);

  if (ROTAS_PUBLICAS.has(pathname)) {
    if (pathname === "/login" && sessao) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!sessao) {
    // API responde 401 em JSON; o fetch do cliente sabe lidar. Devolver
    // o HTML do /login para um `fetch` só produziria erro de parse.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
    }

    const destino = new URL("/login", request.url);
    const proximo = `${pathname}${request.nextUrl.search}`;
    if (proximo !== "/") destino.searchParams.set("proximo", proximo);
    return NextResponse.redirect(destino);
  }

  const resposta = NextResponse.next();

  const faltamSegundos = sessao.expiraEm - Math.floor(Date.now() / 1000);
  if (faltamSegundos < RENOVAR_QUANDO_FALTAR_SEGUNDOS) {
    resposta.cookies.set(COOKIE_SESSAO, await emitirSessao(sessao.email), opcoesCookieSessao());
  }

  return resposta;
}

/**
 * Sem cabeçalho `Origin` a requisição é recusada. Todo navegador manda
 * `Origin` em POST/DELETE; quem não manda é cliente programático, e
 * este app não tem nenhum.
 */
function origemConfere(request: NextRequest): boolean {
  const origem = request.headers.get("origin");
  if (!origem) return false;

  // Atrás do Traefik o `Host` do container é interno; quem carrega o
  // domínio real é o X-Forwarded-Host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

export const config = {
  // Tudo passa pelo porteiro, menos o que o próprio Next serve estático
  // (bundles, imagens otimizadas, fontes do next/font) — que precisa
  // carregar na própria tela de login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
