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

/**
 * Tentativa de mexer num lembrete que já é história.
 *
 * Separado de `TransicaoInvalidaError` porque não é uma transição de
 * status: editar não muda o estado do lembrete, e quem chama precisa
 * distinguir os dois casos para responder a coisa certa.
 */
export class LembreteImutavelError extends DomainError {
  constructor(statusAtual: string) {
    super(`Um lembrete ${statusAtual} não pode mais ser editado`);
    this.name = "LembreteImutavelError";
  }
}
