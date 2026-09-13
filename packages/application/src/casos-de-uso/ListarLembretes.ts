import type { FiltroLembretes, LembreteRepository, StatusLembrete } from "@advice/domain";

export interface LembreteResumo {
  id: string;
  titulo: string;
  agendadoPara: Date;
  status: StatusLembrete;
}

export interface ListarLembretesDeps {
  lembreteRepository: LembreteRepository;
}

export async function listarLembretes(deps: ListarLembretesDeps, filtro?: FiltroLembretes): Promise<LembreteResumo[]> {
  const lembretes = await deps.lembreteRepository.listar(filtro);

  return lembretes
    .map((lembrete) => ({
      id: lembrete.getId().toString(),
      titulo: lembrete.getTitulo(),
      agendadoPara: lembrete.getAgendamento().paraData(),
      status: lembrete.getStatus(),
    }))
    .sort((a, b) => a.agendadoPara.getTime() - b.agendadoPara.getTime());
}
