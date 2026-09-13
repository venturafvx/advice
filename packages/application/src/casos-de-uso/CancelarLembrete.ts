import { LembreteId } from "@advice/domain";
import type { LembreteRepository } from "@advice/domain";

export class LembreteNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Lembrete ${id} não encontrado`);
    this.name = "LembreteNaoEncontradoError";
  }
}

export interface CancelarLembreteDeps {
  lembreteRepository: LembreteRepository;
}

export async function cancelarLembrete(id: string, deps: CancelarLembreteDeps): Promise<void> {
  const lembreteId = LembreteId.de(id);
  const lembrete = await deps.lembreteRepository.buscarPorId(lembreteId);

  if (!lembrete) {
    throw new LembreteNaoEncontradoError(id);
  }

  lembrete.cancelar();
  await deps.lembreteRepository.salvar(lembrete);
}
