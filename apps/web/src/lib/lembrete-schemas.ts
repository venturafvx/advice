import { z } from "zod";
import type { CriarLembreteInput } from "@advice/application";
import type { Frequencia } from "@advice/domain";

/**
 * O contrato HTTP dos lembretes, num lugar só.
 *
 * Criar e editar recebem exatamente a mesma forma — porque são a mesma
 * decisão ("uma vez ou repetindo?") tomada em momentos diferentes.
 * Duplicar o schema seria abrir espaço para os dois divergirem em
 * silêncio, e a divergência apareceria como um lembrete agendado errado.
 */
const recorrenciaSchema = z.object({
  // `satisfies` amarra a lista ao domínio: acrescentar uma frequência lá
  // e esquecer daqui vira erro de compilação, não bug de runtime.
  frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL"] satisfies readonly Frequencia[]),
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
  diasDaSemana: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  diaDoMes: z.number().int().min(1).max(31).nullable().default(null),
});

const titulo = z.string().trim().min(1, "Informe o que você quer lembrar").max(200);

/**
 * União, não objeto com dois campos opcionais: um lembrete é uma data
 * única **ou** uma repetição, e `strictObject` faz o servidor recusar um
 * corpo que tente ser os dois em vez de escolher um em silêncio.
 */
export const lembreteSchema = z.union(
  [
    z.strictObject({ titulo, agendadoPara: z.iso.datetime({ local: true }) }),
    z.strictObject({ titulo, recorrencia: recorrenciaSchema }),
  ],
  { error: "Informe uma data e hora, ou uma repetição" },
);

export type LembreteEntrada = z.infer<typeof lembreteSchema>;

/**
 * Traduz o corpo validado no input dos casos de uso.
 *
 * `CriarLembreteInput` e `EditarLembreteInput` têm a mesma forma, então
 * uma função serve às duas rotas — o que é a garantia de que criar e
 * editar nunca interpretem o mesmo corpo de formas diferentes.
 */
export function paraInputDeLembrete(dados: LembreteEntrada): CriarLembreteInput {
  return "recorrencia" in dados
    ? { titulo: dados.titulo, recorrencia: dados.recorrencia }
    : { titulo: dados.titulo, agendadoPara: new Date(dados.agendadoPara) };
}

/**
 * Termo de busca vindo da query string.
 *
 * Teto de 200 caracteres pelo mesmo motivo do título: é o tamanho
 * máximo do que existe para encontrar. Vazio vira `undefined` — "buscar
 * por nada" é não buscar, não é buscar por string vazia.
 */
export const buscaSchema = z
  .string()
  .trim()
  .max(200)
  .transform((valor) => valor || undefined);
