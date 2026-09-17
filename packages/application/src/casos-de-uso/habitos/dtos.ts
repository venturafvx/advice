import type { CadenciaProps, DesempenhoDoHabito, SituacaoDoDia } from "@advice/domain";

/**
 * DTOs do contexto de Hábitos.
 *
 * Dias saem como `YYYY-MM-DD` — a mesma forma que `DiaCivil` já tem, e
 * a mesma da coluna no banco. Nenhum `Date` atravessa a fronteira: um
 * `Date` aqui obrigaria a serializar em cada página e reabriria a porta
 * para o fuso do browser decidir que dia é hoje.
 *
 * Carimbos de tempo de verdade (`criadoEm`) saem em ISO 8601, como no
 * contexto de Operação.
 */

export interface RelatoDoDiaDto {
  dia: string;
  situacao: SituacaoDoDia;
  /** O que aconteceu. */
  observacao: string | null;
  /** O que passou pela cabeça. */
  pensamento: string | null;
}

/** Um quadradinho da faixa da semana. */
export interface DiaDaSemanaDto {
  dia: string;
  /** A regra cobra este dia? Meta flexível responde `false` em todos. */
  exigido: boolean;
  situacao: SituacaoDoDia | null;
  /** Dia que ainda não chegou — não é falha, é futuro. */
  futuro: boolean;
}

export interface HabitoDto {
  id: string;
  nome: string;
  motivacao: string | null;
  cadencia: CadenciaProps;
  arquivado: boolean;
  criadoEm: string;
  desempenho: DesempenhoDoHabito;
  /** A semana corrente, de segunda a domingo. */
  semana: DiaDaSemanaDto[];
  /** O que já foi declarado hoje, com o relato — o formulário abre com isto. */
  hoje: RelatoDoDiaDto | null;
}

/** Uma quebra com relato, para o diário da tela. */
export interface QuebraDto {
  habitoId: string;
  habitoNome: string;
  dia: string;
  observacao: string | null;
  pensamento: string | null;
}

export interface PainelDeHabitosDto {
  /** O hoje do servidor, no timezone do app. A tela nunca calcula o seu. */
  hoje: string;
  habitos: HabitoDto[];
  quebras: QuebraDto[];
}

/** O que os formulários e a API mandam para criar ou editar um hábito. */
export interface HabitoInput {
  nome: string;
  cadencia: CadenciaProps;
  motivacao: string | null;
}

/** O que a tela manda ao ticar ou ao registrar uma quebra. */
export interface RegistroDoDiaInput {
  dia: string;
  situacao: SituacaoDoDia;
  observacao: string | null;
  pensamento: string | null;
}
