import { LembreteId } from "@advice/domain";
import type { LembreteRepository } from "@advice/domain";
import { LembreteNaoEncontradoError } from "./erros";

export interface CancelarLembreteDeps {
  lembreteRepository: LembreteRepository;
}

/**
 * Encerra um lembrete sem apagá-lo: ele vira CANCELADO e desce para o
 * histórico. Numa série, é assim que a repetição acaba — sem ocorrência
 * pendente, ninguém gera a próxima.
 */
export async function cancelarLembrete(id: string, deps: CancelarLembreteDeps): Promise<void> {
  const lembreteId = LembreteId.de(id);
  const lembrete = await deps.lembreteRepository.buscarPorId(lembreteId);

  if (!lembrete) {
    throw new LembreteNaoEncontradoError(id);
  }

  lembrete.cancelar();

  // `atualizar` e não `salvar`: se o lembrete tiver sido apagado entre a
  // leitura e a escrita, ele fica apagado — um upsert o ressuscitaria
  // como CANCELADO.
  if (!(await deps.lembreteRepository.atualizar(lembrete))) {
    throw new LembreteNaoEncontradoError(id);
  }
}
