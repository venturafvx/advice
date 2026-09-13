import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class ServicoId {
  private constructor(private readonly valor: string) {}

  static novo(): ServicoId {
    return new ServicoId(randomUUID());
  }

  static de(valor: string): ServicoId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("ServicoId não pode ser vazio");
    }
    return new ServicoId(valor);
  }

  toString(): string {
    return this.valor;
  }
}
