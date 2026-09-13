import type { Lembrete } from "../lembrete/Lembrete";
import type { LembreteId } from "../lembrete/LembreteId";
import type { StatusLembrete } from "../lembrete/StatusLembrete";

export interface FiltroLembretes {
  status?: StatusLembrete;
}

export interface LembreteRepository {
  salvar(lembrete: Lembrete): Promise<void>;
  buscarPorId(id: LembreteId): Promise<Lembrete | null>;
  listar(filtro?: FiltroLembretes): Promise<Lembrete[]>;
  buscarPendentesVencidos(agora: Date): Promise<Lembrete[]>;
}
