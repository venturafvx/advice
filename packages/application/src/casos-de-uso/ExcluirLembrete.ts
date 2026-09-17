import { LembreteId } from "@advice/domain";
import type { LembreteRepository } from "@advice/domain";
import { LembreteNaoEncontradoError } from "./erros";

export interface ExcluirLembreteDeps {
  lembreteRepository: LembreteRepository;
}

/**
 * Apaga o lembrete de verdade — a linha some, junto com os Envios que
 * ela produziu.
 *
 * Diferente de `cancelarLembrete`, que preserva o registro do que foi
 * decidido. Cancelar responde "isso não vai mais acontecer"; excluir
 * responde "isso não precisa mais estar na minha tela". São perguntas
 * diferentes e por isso são dois verbos, não um com bandeira.
 *
 * Excluir a ocorrência PENDENTE de uma série encerra a série, pelo mesmo
 * motivo que cancelar encerra: ninguém sobra para gerar a próxima.
 */
export async function excluirLembrete(id: string, deps: ExcluirLembreteDeps): Promise<void> {
  if (!(await deps.lembreteRepository.excluir(LembreteId.de(id)))) {
    throw new LembreteNaoEncontradoError(id);
  }
}

/**
 * Apaga o histórico inteiro e devolve quantos lembretes foram embora.
 *
 * Só toca em estado terminal: o que ainda vai acontecer não é histórico
 * e não pode sumir numa faxina.
 */
export async function limparHistorico(deps: ExcluirLembreteDeps): Promise<number> {
  return deps.lembreteRepository.excluirHistorico();
}
