import { DiaCivil, HabitoId, RegistroDeHabito, TIMEZONE_PADRAO } from "@advice/domain";
import type { HabitoRepository, RegistroDeHabitoRepository, SituacaoDoDia } from "@advice/domain";
import type { RegistroDoDiaInput } from "./dtos";
import { HabitoNaoEncontradoError } from "./erros";

export interface RegistroDeHabitoDeps {
  habitoRepository: HabitoRepository;
  registroRepository: RegistroDeHabitoRepository;
}

/** Ninguém declara o futuro. Um registro adiante seria uma promessa disfarçada de fato. */
export class DiaNoFuturoError extends Error {
  constructor(dia: string) {
    super(`Não dá para registrar ${dia}: o dia ainda não chegou`);
    this.name = "DiaNoFuturoError";
  }
}

/**
 * Declara (ou corrige) o que aconteceu num dia.
 *
 * É sempre a mesma operação, venha do "Feito" de hoje ou da correção de
 * um dia atrás: o repositório faz upsert pelo par (hábito, dia), então
 * dois cliques no mesmo botão produzem um registro, não dois. Ter um
 * caso de uso "criar" e outro "corrigir" seria fingir que existe uma
 * diferença que nem o banco nem a tela enxergam.
 */
export async function registrarDia(
  habitoId: string,
  input: RegistroDoDiaInput,
  deps: RegistroDeHabitoDeps,
  agora: Date = new Date(),
): Promise<{ dia: string; situacao: SituacaoDoDia }> {
  const id = HabitoId.de(habitoId);
  const habito = await deps.habitoRepository.buscarPorId(id);
  if (!habito) {
    throw new HabitoNaoEncontradoError(habitoId);
  }

  const dia = DiaCivil.de(input.dia);
  if (dia.ehDepoisDe(DiaCivil.hoje(TIMEZONE_PADRAO, agora))) {
    throw new DiaNoFuturoError(input.dia);
  }

  // Carregar antes de escrever preserva `registrado_em` do dia — quando
  // ele foi declarado pela primeira vez é história, e corrigir às 22h o
  // que se disse às 8h não deve apagar esse fato.
  const existente = await deps.registroRepository.buscarPorHabitoEDia(id, dia);
  const notas = { observacao: input.observacao, pensamento: input.pensamento };

  if (existente) {
    existente.corrigir(input.situacao, notas, agora);
    await deps.registroRepository.registrarDia(existente);
  } else {
    await deps.registroRepository.registrarDia(
      RegistroDeHabito.registrar(id, dia, input.situacao, notas, agora),
    );
  }

  return { dia: dia.toString(), situacao: input.situacao };
}

/** Desfaz o registro do dia — o tique errado, ou a quebra que não era. */
export async function apagarRegistroDoDia(
  habitoId: string,
  dia: string,
  deps: Pick<RegistroDeHabitoDeps, "registroRepository">,
): Promise<boolean> {
  return deps.registroRepository.apagarDoDia(HabitoId.de(habitoId), DiaCivil.de(dia));
}
