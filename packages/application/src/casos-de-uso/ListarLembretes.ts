import { StatusLembrete } from "@advice/domain";
import type { FiltroLembretes, Lembrete, LembreteRepository, RecorrenciaProps } from "@advice/domain";

export interface LembreteResumo {
  id: string;
  titulo: string;
  agendadoPara: Date;
  status: StatusLembrete;
  /** `null` num lembrete avulso. */
  recorrencia: RecorrenciaProps | null;
  /** Identidade estável da repetição ao longo de todas as suas ocorrências. */
  serieId: string | null;
}

export interface ListarLembretesDeps {
  lembreteRepository: LembreteRepository;
}

/** Quantas ocorrências terminais o painel mostra. Uma série diária produz 365 por ano. */
export const LIMITE_HISTORICO_PADRAO = 40;

/**
 * Quantas o painel mostra quando há uma busca ativa.
 *
 * Buscar tem de alcançar mais fundo que folhear: procurar "fornecedor" e
 * receber só o que estivesse nos 40 mais recentes seria uma resposta
 * errada com cara de certa. O teto continua existindo porque a tabela
 * não tem teto.
 */
export const LIMITE_HISTORICO_BUSCA = 200;

function paraResumo(lembrete: Lembrete): LembreteResumo {
  return {
    id: lembrete.getId().toString(),
    titulo: lembrete.getTitulo(),
    agendadoPara: lembrete.getAgendamento().paraData(),
    status: lembrete.getStatus(),
    recorrencia: lembrete.getRecorrencia()?.paraProps() ?? null,
    serieId: lembrete.getSerieId()?.toString() ?? null,
  };
}

/** Do mais próximo ao mais distante — a ordem em que as coisas vão acontecer. */
export async function listarLembretes(
  deps: ListarLembretesDeps,
  filtro?: FiltroLembretes,
): Promise<LembreteResumo[]> {
  const lembretes = await deps.lembreteRepository.listar(filtro);
  return lembretes.map(paraResumo).sort((a, b) => a.agendadoPara.getTime() - b.agendadoPara.getTime());
}

/**
 * A fila do que ainda vai acontecer, opcionalmente filtrada por um termo.
 *
 * Existe para que a tela não precise montar o filtro à mão — montar
 * filtro é decisão de aplicação, e repeti-la em cada chamador é como se
 * esquece de passar o termo em um deles.
 */
export async function listarPendentes(deps: ListarLembretesDeps, termo?: string): Promise<LembreteResumo[]> {
  return listarLembretes(
    deps,
    termo ? { status: StatusLembrete.PENDENTE, termo } : { status: StatusLembrete.PENDENTE },
  );
}

/** Do mais recente ao mais antigo — a ordem em que as coisas aconteceram. */
export async function listarHistorico(deps: ListarLembretesDeps, termo?: string): Promise<LembreteResumo[]> {
  const limite = termo ? LIMITE_HISTORICO_BUSCA : LIMITE_HISTORICO_PADRAO;
  const lembretes = await deps.lembreteRepository.listarHistorico(termo ? { limite, termo } : { limite });
  return lembretes.map(paraResumo);
}
