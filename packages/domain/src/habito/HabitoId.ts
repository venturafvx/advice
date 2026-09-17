import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class HabitoId {
  private constructor(private readonly valor: string) {}

  static novo(): HabitoId {
    return new HabitoId(randomUUID());
  }

  static de(valor: string): HabitoId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("HabitoId não pode ser vazio");
    }
    return new HabitoId(valor);
  }

  igual(outro: HabitoId): boolean {
    return this.valor === outro.valor;
  }

  toString(): string {
    return this.valor;
  }
}
