import { Cadencia, Habito, HabitoId } from "@advice/domain";
import type { HabitoRepository } from "@advice/domain";
import type { HabitoInput } from "./dtos";
import { HabitoDuplicadoError, HabitoNaoEncontradoError } from "./erros";

export interface HabitoDeps {
  habitoRepository: HabitoRepository;
}

/**
 * Criar, editar, arquivar e apagar devolvem só o id.
 *
 * A tela recarrega o painel inteiro depois de qualquer ação, porque o
 * que ela mostra (sequência, aderência, faixa da semana) depende de
 * registros que a ação não carrega. Devolver um `HabitoDto` aqui seria
 * montar uma segunda vez uma resposta que ninguém usa — e abrir espaço
 * para ela divergir da do painel.
 */
export async function criarHabito(input: HabitoInput, deps: HabitoDeps): Promise<{ id: string }> {
  await exigirNomeLivre(input.nome, null, deps);

  const habito = Habito.criar(input.nome, Cadencia.de(input.cadencia), input.motivacao);
  await deps.habitoRepository.salvar(habito);
  return { id: habito.getId().toString() };
}

export async function editarHabito(
  id: string,
  input: HabitoInput,
  deps: HabitoDeps,
): Promise<{ id: string }> {
  const habito = await carregar(id, deps);
  await exigirNomeLivre(input.nome, habito.getId().toString(), deps);

  habito.editar(input.nome, Cadencia.de(input.cadencia), input.motivacao);
  await deps.habitoRepository.salvar(habito);
  return { id };
}

/**
 * Arquivar tira da agenda preservando tudo: os registros continuam
 * apontando para o hábito e o histórico não perde o nome do que foi
 * feito. É o caminho normal para "parei com esse" — apagar é outro
 * verbo, para outra situação.
 */
export async function definirArquivamento(
  id: string,
  arquivar: boolean,
  deps: HabitoDeps,
): Promise<{ id: string }> {
  const habito = await carregar(id, deps);

  if (arquivar) {
    habito.arquivar();
  } else {
    // Reativar recoloca o nome em circulação, então ele precisa estar
    // livre: outro hábito ativo pode ter nascido com esse nome enquanto
    // este estava arquivado.
    await exigirNomeLivre(habito.getNome(), habito.getId().toString(), deps);
    habito.reativar();
  }

  await deps.habitoRepository.salvar(habito);
  return { id };
}

/**
 * Apaga o hábito e todos os registros dele, de verdade e sem volta.
 *
 * Existe para o hábito criado por engano. Quem quer parar com um hábito
 * real arquiva — e a tela deixa isso claro, oferecendo os dois com
 * nomes diferentes em vez de um botão que faz uma coisa e diz outra.
 */
export async function excluirHabito(id: string, deps: HabitoDeps): Promise<void> {
  const apagado = await deps.habitoRepository.excluir(HabitoId.de(id));
  if (!apagado) {
    throw new HabitoNaoEncontradoError(id);
  }
}

async function exigirNomeLivre(nome: string, proprioId: string | null, deps: HabitoDeps): Promise<void> {
  // O banco tem índice único case-insensitive entre os ativos; esta
  // checagem existe para devolver um erro de negócio legível em vez de
  // um erro de constraint cru. A garantia dura continua sendo a do banco.
  const existente = await deps.habitoRepository.buscarPorNome(nome);
  if (existente && existente.getId().toString() !== proprioId) {
    throw new HabitoDuplicadoError(nome.trim());
  }
}

async function carregar(id: string, deps: HabitoDeps): Promise<Habito> {
  const habito = await deps.habitoRepository.buscarPorId(HabitoId.de(id));
  if (!habito) {
    throw new HabitoNaoEncontradoError(id);
  }
  return habito;
}
