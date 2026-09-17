/**
 * Erros de caso de uso do contexto de Lembretes.
 *
 * Vivem fora dos arquivos de caso de uso porque três deles (cancelar,
 * editar, excluir) precisam do mesmo: um erro compartilhado importado
 * do arquivo de quem por acaso o declarou primeiro seria acoplamento
 * por acidente.
 */
export class LembreteNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Lembrete ${id} não encontrado`);
    this.name = "LembreteNaoEncontradoError";
  }
}
