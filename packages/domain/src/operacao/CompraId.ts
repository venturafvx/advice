import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class CompraId {
  private constructor(private readonly valor: string) {}

  static novo(): CompraId {
    return new CompraId(randomUUID());
  }

  static de(valor: string): CompraId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("CompraId não pode ser vazio");
    }
    return new CompraId(valor);
  }

  toString(): string {
    return this.valor;
  }
}
