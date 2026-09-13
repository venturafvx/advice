import { AgendamentoInfo, Lembrete } from "@advice/domain";
import type { LembreteRepository } from "@advice/domain";

export interface CriarLembreteInput {
  titulo: string;
  agendadoPara: Date;
  timezone?: string;
}

export interface CriarLembreteDeps {
  lembreteRepository: LembreteRepository;
}

export interface CriarLembreteResultado {
  id: string;
}

export async function criarLembrete(input: CriarLembreteInput, deps: CriarLembreteDeps): Promise<CriarLembreteResultado> {
  const agendamento = AgendamentoInfo.criar(input.agendadoPara, input.timezone);
  const lembrete = Lembrete.criar(input.titulo, agendamento);

  await deps.lembreteRepository.salvar(lembrete);

  return { id: lembrete.getId().toString() };
}
