import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class RegistroDeHabitoId {
  private constructor(private readonly valor: string) {}

  static novo(): RegistroDeHabitoId {
    return new RegistroDeHabitoId(randomUUID());
  }

  static de(valor: string): RegistroDeHabitoId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("RegistroDeHabitoId não pode ser vazio");
    }
    return new RegistroDeHabitoId(valor);
  }

  toString(): string {
    return this.valor;
  }
}
