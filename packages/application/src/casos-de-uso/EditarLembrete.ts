import { LembreteId, Recorrencia, TIMEZONE_PADRAO } from "@advice/domain";
import type { LembreteRepository, NovoAgendamento, RecorrenciaProps } from "@advice/domain";
import { LembreteNaoEncontradoError } from "./erros";

/**
 * Mesma união de `CriarLembreteInput`, e de propósito: editar não é uma
 * operação de forma diferente da de criar — é a mesma decisão ("uma vez
 * ou repetindo?") tomada de novo. É por isso que o formulário da tela é
 * literalmente o mesmo componente.
 */
export type EditarLembreteInput = {
  titulo: string;
  timezone?: string;
} & (
  | { agendadoPara: Date; recorrencia?: undefined }
  | { agendadoPara?: undefined; recorrencia: RecorrenciaProps }
);

export interface EditarLembreteDeps {
  lembreteRepository: LembreteRepository;
}

export interface EditarLembreteResultado {
  id: string;
  agendadoPara: Date;
}

export async function editarLembrete(
  id: string,
  input: EditarLembreteInput,
  deps: EditarLembreteDeps,
): Promise<EditarLembreteResultado> {
  const lembreteId = LembreteId.de(id);
  const lembrete = await deps.lembreteRepository.buscarPorId(lembreteId);

  if (!lembrete) {
    throw new LembreteNaoEncontradoError(id);
  }

  const timezone = input.timezone ?? TIMEZONE_PADRAO;
  const quando: NovoAgendamento = input.recorrencia
    ? { tipo: "RECORRENTE", recorrencia: Recorrencia.de(input.recorrencia), timezone }
    : { tipo: "AVULSO", instante: input.agendadoPara, timezone };

  lembrete.editar(input.titulo, quando);

  if (!(await deps.lembreteRepository.atualizar(lembrete))) {
    throw new LembreteNaoEncontradoError(id);
  }

  return { id: lembrete.getId().toString(), agendadoPara: lembrete.getAgendamento().paraData() };
}
