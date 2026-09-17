import type { Lembrete } from "../lembrete/Lembrete";
import type { LembreteId } from "../lembrete/LembreteId";
import type { StatusLembrete } from "../lembrete/StatusLembrete";

export interface FiltroLembretes {
  status?: StatusLembrete;
  /**
   * Busca livre no título. Vazio ou ausente não filtra nada.
   *
   * Fica na porta, e não numa filtragem em memória depois de listar,
   * porque com recorrência a tabela não tem teto: uma série diária
   * produz 365 linhas por ano, e "carregar tudo para procurar" vira
   * lentidão garantida com o tempo.
   */
  termo?: string;
}

export interface OpcoesHistorico {
  /** Obrigatório: o histórico cresce um registro por disparo, para sempre. */
  limite: number;
  termo?: string;
}

export interface LembreteRepository {
  /**
   * Grava um lembrete que pode não existir ainda (upsert).
   *
   * O upsert é o que torna idempotente a materialização da próxima
   * ocorrência de uma série — ver `LembreteId.daOcorrencia`.
   */
  salvar(lembrete: Lembrete): Promise<void>;
  /**
   * Grava o novo estado de um lembrete que **já existe**, e devolve
   * `false` se ele não existe mais.
   *
   * Existe separado de `salvar` por causa da exclusão: com um upsert,
   * apagar um lembrete no segundo em que o worker o envia o traria de
   * volta do nada, já marcado como ENVIADO. Um UPDATE sem linha
   * simplesmente não faz nada — que é a resposta certa para "isto foi
   * apagado enquanto eu trabalhava".
   */
  atualizar(lembrete: Lembrete): Promise<boolean>;
  buscarPorId(id: LembreteId): Promise<Lembrete | null>;
  listar(filtro?: FiltroLembretes): Promise<Lembrete[]>;
  /**
   * Lembretes em estado terminal, do mais recente para o mais antigo.
   *
   * Existe separado de `listar` por causa da recorrência: um lembrete
   * diário produz 365 ocorrências por ano, e carregar a tabela inteira
   * para desenhar um histórico seria uma regressão garantida de
   * performance com o tempo. O limite é do chamador, mas é obrigatório.
   */
  listarHistorico(opcoes: OpcoesHistorico): Promise<Lembrete[]>;
  buscarPendentesVencidos(agora: Date): Promise<Lembrete[]>;
  /**
   * Apaga o lembrete e os Envios que ele produziu. `false` se já não
   * existia.
   *
   * Exclusão é irreversível e definitiva de propósito: o fundador pediu
   * para poder apagar, e um "apagar" que na verdade esconde deixaria o
   * banco crescendo com lixo que ninguém mais vê. Os Envios vão junto
   * porque são o log de entrega *daquele* lembrete — sem ele, não
   * significam nada.
   */
  excluir(id: LembreteId): Promise<boolean>;
  /**
   * Apaga todos os lembretes em estado terminal (e seus Envios), e
   * devolve quantos foram. Não toca em PENDENTE: limpar o histórico é
   * varrer o passado, nunca desmarcar o que ainda vai acontecer.
   */
  excluirHistorico(): Promise<number>;
}
