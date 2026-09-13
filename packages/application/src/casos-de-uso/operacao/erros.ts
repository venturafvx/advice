export class CompraNaoEncontradaError extends Error {
  constructor(id: string) {
    super(`Compra ${id} não encontrada`);
    this.name = "CompraNaoEncontradaError";
  }
}

export class ServicoNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Serviço ${id} não encontrado`);
    this.name = "ServicoNaoEncontradoError";
  }
}

export class CategoriaDeCustoNaoEncontradaError extends Error {
  constructor(id: string) {
    super(`Categoria de custo ${id} não encontrada`);
    this.name = "CategoriaDeCustoNaoEncontradaError";
  }
}

export class CategoriaDeCustoDuplicadaError extends Error {
  constructor(nome: string) {
    super(`Já existe uma categoria de custo chamada "${nome}"`);
    this.name = "CategoriaDeCustoDuplicadaError";
  }
}
