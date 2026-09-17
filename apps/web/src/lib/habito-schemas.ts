import { z } from "zod";
import type { CadenciaProps, FrequenciaDoHabito, SituacaoDoDia } from "@advice/domain";
import type { HabitoInput, RegistroDoDiaInput } from "@advice/application";

/**
 * O contrato HTTP dos hábitos, num lugar só.
 *
 * A cadência é uma **união**, não um objeto com três campos opcionais.
 * Assim "DIAS_DA_SEMANA sem nenhum dia" não chega nem a ser um corpo
 * válido — a mesma lição do CHECK no banco, aplicada uma camada acima:
 * o formato que não pode existir não deve ser representável.
 */
const cadenciaSchema = z.union(
  [
    z.strictObject({ frequencia: z.literal("DIARIA" satisfies FrequenciaDoHabito) }),
    z.strictObject({
      frequencia: z.literal("DIAS_DA_SEMANA" satisfies FrequenciaDoHabito),
      diasDaSemana: z
        .array(z.number().int().min(0).max(6))
        .min(1, "Escolha pelo menos um dia da semana")
        .max(7),
    }),
    z.strictObject({
      frequencia: z.literal("VEZES_POR_SEMANA" satisfies FrequenciaDoHabito),
      vezesPorSemana: z.number().int().min(1).max(7),
    }),
  ],
  { error: "Escolha como o hábito se repete" },
);

/** Texto livre opcional: em branco é ausência, nunca string vazia. */
function textoOpcional(maximo: number, rotulo: string) {
  return z
    .string()
    .trim()
    .max(maximo, `${rotulo} não pode ter mais que ${maximo} caracteres`)
    .nullish()
    .transform((valor) => valor || null);
}

export const habitoSchema = z.strictObject({
  nome: z.string().trim().min(1, "Dê um nome ao hábito").max(60),
  motivacao: textoOpcional(500, "A motivação"),
  cadencia: cadenciaSchema,
});

export type HabitoEntrada = z.infer<typeof habitoSchema>;

export function paraInputDeHabito(dados: HabitoEntrada): HabitoInput {
  return { nome: dados.nome, motivacao: dados.motivacao, cadencia: paraCadencia(dados.cadencia) };
}

function paraCadencia(cadencia: HabitoEntrada["cadencia"]): CadenciaProps {
  if (cadencia.frequencia === "DIAS_DA_SEMANA") {
    return { frequencia: cadencia.frequencia, diasDaSemana: cadencia.diasDaSemana, vezesPorSemana: null };
  }
  if (cadencia.frequencia === "VEZES_POR_SEMANA") {
    return { frequencia: cadencia.frequencia, diasDaSemana: [], vezesPorSemana: cadencia.vezesPorSemana };
  }
  return { frequencia: cadencia.frequencia, diasDaSemana: [], vezesPorSemana: null };
}

/**
 * `AAAA-MM-DD`, validado como forma aqui e como data real no domínio
 * (`DiaCivil.de` recusa 2026-02-30). O regex não tenta saber quantos
 * dias tem fevereiro — quem sabe isso é o calendário, não a borda.
 */
export const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");

export const registroDoDiaSchema = z.strictObject({
  dia: diaSchema,
  situacao: z.enum(["FEITO", "QUEBRADO"] satisfies readonly SituacaoDoDia[]),
  observacao: textoOpcional(2000, "A observação"),
  pensamento: textoOpcional(2000, "O pensamento"),
});

export function paraInputDeRegistro(dados: z.infer<typeof registroDoDiaSchema>): RegistroDoDiaInput {
  return dados;
}

export const arquivamentoSchema = z.strictObject({ arquivado: z.boolean() });
