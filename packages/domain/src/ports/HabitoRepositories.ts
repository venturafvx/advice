import type { DiaCivil } from "../habito/DiaCivil";
import type { Habito } from "../habito/Habito";
import type { HabitoId } from "../habito/HabitoId";
import type { RegistroDeHabito } from "../habito/RegistroDeHabito";

export interface FiltroHabitos {
  /** Por padrão a listagem traz só os ativos — arquivado é histórico, não agenda. */
  incluirArquivados?: boolean;
}

export interface HabitoRepository {
  salvar(habito: Habito): Promise<void>;
  buscarPorId(id: HabitoId): Promise<Habito | null>;
  listar(filtro?: FiltroHabitos): Promise<Habito[]>;
  /**
   * O hábito **ativo** com este nome, ignorando caixa e espaços das
   * pontas — a mesma chave do índice único parcial do banco.
   *
   * Existe para o caso de uso devolver "já existe um hábito assim" em
   * vez de deixar vazar um erro de constraint. A garantia dura continua
   * sendo a do banco; isto é a tradução legível dela.
   */
  buscarPorNome(nome: string): Promise<Habito | null>;
  /**
   * Apaga o hábito e todos os registros dele. `false` se já não existia.
   *
   * Existe ao lado de `arquivar` porque são dois verbos, não um com
   * bandeira — mesma regra dos lembretes. Arquivar preserva o histórico;
   * apagar é para o hábito criado por engano, e leva tudo junto de
   * propósito: registros órfãos de um hábito que não existe mais não
   * significam nada.
   */
  excluir(id: HabitoId): Promise<boolean>;
}

export interface RegistroDeHabitoRepository {
  /**
   * Grava o dia, criando ou corrigindo (upsert por hábito + dia).
   *
   * É a escrita idempotente que sustenta "um registro por hábito por
   * dia": ticar duas vezes, ou dois cliques no mesmo botão, não podem
   * produzir dois veredictos sobre o mesmo dia.
   */
  registrarDia(registro: RegistroDeHabito): Promise<void>;
  buscarPorHabitoEDia(habitoId: HabitoId, dia: DiaCivil): Promise<RegistroDeHabito | null>;
  /**
   * Todos os registros de todos os hábitos a partir de um dia.
   *
   * Uma consulta para a tela inteira, não uma por hábito: o painel
   * mostra a semana de todos de uma vez, e N+1 aqui seria N+1 para
   * sempre, crescendo com a quantidade de hábitos.
   */
  listarDesde(dia: DiaCivil): Promise<RegistroDeHabito[]>;
  /**
   * As quebras mais recentes que têm algo escrito, da mais nova para a
   * mais antiga. O limite é obrigatório: isto cresce um registro por
   * recaída, para sempre.
   */
  listarQuebrasComRelato(limite: number): Promise<RegistroDeHabito[]>;
  /** Desfaz o registro do dia (o tique errado). `false` se não havia nada. */
  apagarDoDia(habitoId: HabitoId, dia: DiaCivil): Promise<boolean>;
}
