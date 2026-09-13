import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class EnvioId {
  private constructor(private readonly valor: string) {}

  static novo(): EnvioId {
    return new EnvioId(randomUUID());
  }

  static de(valor: string): EnvioId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("EnvioId não pode ser vazio");
    }
    return new EnvioId(valor);
  }

  toString(): string {
    return this.valor;
  }
}
