import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trava de arquitetura, não teste de unidade.
 *
 * A autorização deste app é explícita em cada handler (ver
 * `sessaoAtual.ts` e `proxy.ts`): é o que sobrevive a um matcher mal
 * editado. O preço desse desenho é que uma rota nova pode nascer sem a
 * guarda e ninguém perceber em code review.
 *
 * Este teste é quem percebe. Ele varre o diretório de rotas de verdade,
 * não uma lista mantida à mão — rota nova aparece aqui sozinha.
 */

const DIRETORIO_APP = resolve(import.meta.dirname, "..", "..", "app");
const DIRETORIO_API = join(DIRETORIO_APP, "api");

/**
 * As únicas rotas que podem não exigir sessão — e por quê:
 *
 *  - `auth/login`  é a porta. Exigir sessão para entrar seria um ciclo.
 *  - `auth/logout` só apaga o cookie. Exigir sessão válida para sair
 *    deixaria quem tem cookie corrompido preso na tela de erro.
 *
 * Acrescentar qualquer coisa a esta lista é uma decisão de segurança:
 * exige justificativa escrita aqui.
 */
const PUBLICAS = new Set(["auth/login/route.ts", "auth/logout/route.ts"]);

const METODOS_HTTP = /^export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\(/gm;

function buscar(diretorio: string, alvo: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) return buscar(caminho, alvo);
    return entrada.name === alvo ? [caminho] : [];
  });
}

function relativoA(base: string) {
  return (caminho: string): string => relative(base, caminho).split("\\").join("/");
}

describe("toda rota de API exige sessão", () => {
  const arquivos = buscar(DIRETORIO_API, "route.ts");

  it("encontra as rotas no disco (guarda contra o teste virar vácuo)", () => {
    expect(arquivos.length).toBeGreaterThan(5);
  });

  it.each(arquivos.map(relativoA(DIRETORIO_API)).filter((relativo) => !PUBLICAS.has(relativo)))(
    "%s chama sessaoAtual() em cada handler",
    (relativo) => {
      const conteudo = readFileSync(join(DIRETORIO_API, relativo), "utf8");
      const handlers = conteudo.match(METODOS_HTTP) ?? [];
      const guardas =
        conteudo.match(/if \(!\(await sessaoAtual\(\)\)\) return respostaNaoAutenticado\(\);/g) ?? [];

      expect(handlers.length).toBeGreaterThan(0);
      expect(guardas).toHaveLength(handlers.length);
    },
  );
});

describe("toda página exige sessão", () => {
  const paginas = buscar(DIRETORIO_APP, "page.tsx")
    .map(relativoA(DIRETORIO_APP))
    .filter((relativo) => relativo !== "login/page.tsx");

  it("encontra as páginas no disco", () => {
    expect(paginas.length).toBeGreaterThan(1);
  });

  it.each(paginas)("%s chama exigirSessao()", (relativo) => {
    const conteudo = readFileSync(join(DIRETORIO_APP, relativo), "utf8");
    expect(conteudo).toContain("await exigirSessao()");
  });
});
