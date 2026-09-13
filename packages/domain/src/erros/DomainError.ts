export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class TransicaoInvalidaError extends DomainError {
  constructor(statusAtual: string, statusDesejado: string) {
    super(`Transição de status inválida: ${statusAtual} -> ${statusDesejado}`);
    this.name = "TransicaoInvalidaError";
  }
}
