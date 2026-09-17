import { describe, expect, it } from "vitest";
import { NEGOCIOS, Negocio } from "@advice/domain";
import { caminhoDoNegocio, negocioDeSlug, PERFIS, PERFIS_LISTA, perfilDe, perfilPorSlug } from "./negocios";

describe("perfis de negócio", () => {
  it("todo negócio do domínio tem perfil — negócio novo sem perfil quebra aqui, não em produção", () => {
    expect(PERFIS_LISTA).toHaveLength(NEGOCIOS.length);
    for (const negocio of NEGOCIOS) {
      expect(PERFIS[negocio]).toBeDefined();
      expect(perfilDe(negocio).negocio).toBe(negocio);
    }
  });

  it("os slugs são únicos — dois negócios na mesma URL seria um deles invisível", () => {
    const slugs = PERFIS_LISTA.map((perfil) => perfil.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("nenhum slug colide com uma rota estática de /operacao", () => {
    // `/operacao/categorias` é irmã de `/operacao/[negocio]`. O Next
    // resolve o segmento estático primeiro, então um negócio chamado
    // "categorias" simplesmente nunca abriria.
    const reservados = new Set(["categorias"]);
    for (const perfil of PERFIS_LISTA) {
      expect(reservados.has(perfil.slug)).toBe(false);
    }
  });

  it("vai de slug a negócio e de volta", () => {
    for (const perfil of PERFIS_LISTA) {
      expect(perfilPorSlug(perfil.slug)).toBe(perfil);
      expect(negocioDeSlug(perfil.slug)).toBe(perfil.negocio);
      expect(caminhoDoNegocio(perfil)).toBe(`/operacao/${perfil.slug}`);
    }
  });

  it("recusa slug desconhecido ou ausente, para a página virar 404", () => {
    expect(perfilPorSlug("outra-empresa")).toBeNull();
    expect(perfilPorSlug("")).toBeNull();
    expect(perfilPorSlug(undefined)).toBeNull();
    expect(negocioDeSlug("outra-empresa")).toBeNull();
  });

  it("só o Fabio Junior Decor presta serviço hoje", () => {
    expect(PERFIS[Negocio.FABIOJUNIORDECOR].temServicos).toBe(true);
    expect(PERFIS[Negocio.VENTURAX].temServicos).toBe(false);
  });
});
