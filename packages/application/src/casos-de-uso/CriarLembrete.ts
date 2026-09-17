import { AgendamentoInfo, Lembrete, Recorrencia, TIMEZONE_PADRAO } from "@advice/domain";
import type { LembreteRepository, RecorrenciaProps } from "@advice/domain";

/**
 * Ou uma data única, ou uma regra de repetição — nunca os dois.
 *
 * O tipo é uma união discriminada de propósito: um input com `titulo`,
 * `agendadoPara` **e** `recorrencia` não compila, e por isso não existe
 * a pergunta "quem ganha?" em runtime. Quando há recorrência, a data da
 * primeira ocorrência é derivada da regra pelo domínio.
 */
export type CriarLembreteInput = {
  titulo: string;
  timezone?: string;
} & ({ agendadoPara: Date; recorrencia?: undefined } | { agendadoPara?: undefined; recorrencia: RecorrenciaProps });

export interface CriarLembreteDeps {
  lembreteRepository: LembreteRepository;
}

export interface CriarLembreteResultado {
  id: string;
  agendadoPara: Date;
}

export async function criarLembrete(
  input: CriarLembreteInput,
  deps: CriarLembreteDeps,
): Promise<CriarLembreteResultado> {
  const timezone = input.timezone ?? TIMEZONE_PADRAO;

  const lembrete = input.recorrencia
    ? Lembrete.criarRecorrente(input.titulo, Recorrencia.de(input.recorrencia), timezone)
    : Lembrete.criar(input.titulo, AgendamentoInfo.criar(input.agendadoPara, timezone));

  await deps.lembreteRepository.salvar(lembrete);

  return { id: lembrete.getId().toString(), agendadoPara: lembrete.getAgendamento().paraData() };
}
