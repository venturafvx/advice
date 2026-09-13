import { z } from "zod";
import type { FiltroPeriodo } from "@advice/domain";

/** Teto espelhando o limite de `Dinheiro` no domínio (R$ 1 bilhão). */
const CENTAVOS_MAX = 100_000_000_000;

const custoSchema = z.object({
  categoriaId: z.uuid("Categoria de custo inválida"),
  modo: z.enum(["VALOR_FIXO", "POR_UNIDADE", "PERCENTUAL_DA_VENDA"]),
  valor: z.number().int("Valor de custo inválido").min(0).max(CENTAVOS_MAX),
});

/**
 * Data que vem de um `<input type="date">`: `YYYY-MM-DD`, sem hora e sem
 * fuso. Convertida para meia-noite **local** — `new Date("2026-09-13")`
 * seria meia-noite UTC, que em São Paulo é dia 12 às 21h, e a data da
 * operação apareceria deslocada.
 */
const dataLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((valor, ctx) => {
    const data = new Date(`${valor}T00:00:00`);
    if (Number.isNaN(data.getTime())) {
      ctx.addIssue({ code: "custom", message: "Data inválida" });
      return z.NEVER;
    }
    return data;
  });

const observacaoSchema = z
  .string()
  .max(2_000, "A observação é longa demais")
  .nullish()
  .transform((valor) => valor ?? null);

export const compraSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva o que foi comprado").max(200),
  quantidade: z.number().int("A quantidade precisa ser um número inteiro").min(1).max(1_000_000),
  custoUnitarioCentavos: z.number().int().min(0).max(CENTAVOS_MAX),
  precoVendaUnitarioCentavos: z.number().int().min(0).max(CENTAVOS_MAX),
  compradoEm: dataLocalSchema,
  observacao: observacaoSchema,
  custos: z.array(custoSchema).max(30, "Custos demais numa compra só"),
});

export const servicoSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva o serviço prestado").max(200),
  cliente: z
    .string()
    .max(120)
    .nullish()
    .transform((valor) => valor ?? null),
  valorRecebidoCentavos: z.number().int().min(0).max(CENTAVOS_MAX),
  recebidoEm: dataLocalSchema,
  observacao: observacaoSchema,
  custos: z.array(custoSchema).max(30, "Custos demais num serviço só"),
});

export const categoriaSchema = z.object({
  nome: z.string().trim().min(1, "A categoria precisa de um nome").max(60),
  modoPadrao: z.enum(["VALOR_FIXO", "POR_UNIDADE", "PERCENTUAL_DA_VENDA"]),
  valorPadrao: z.number().int().min(0).max(CENTAVOS_MAX).nullish(),
});

export const arquivamentoSchema = z.object({ arquivada: z.boolean() });

/**
 * Recorte de período vindo da query string (`?de=&ate=`). `ate` vai até
 * o último instante do dia — sem isso, filtrar "até 30/09" excluiria
 * tudo o que aconteceu no próprio dia 30.
 */
export function lerFiltroPeriodo(url: URL): FiltroPeriodo | undefined {
  const de = url.searchParams.get("de");
  const ate = url.searchParams.get("ate");

  const filtro: FiltroPeriodo = {};
  if (de && /^\d{4}-\d{2}-\d{2}$/.test(de)) {
    filtro.de = new Date(`${de}T00:00:00`);
  }
  if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    filtro.ate = new Date(`${ate}T23:59:59.999`);
  }

  return filtro.de || filtro.ate ? filtro : undefined;
}
