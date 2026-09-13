import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class CategoriaDeCustoId {
  private constructor(private readonly valor: string) {}

  static novo(): CategoriaDeCustoId {
    return new CategoriaDeCustoId(randomUUID());
  }

  static de(valor: string): CategoriaDeCustoId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("CategoriaDeCustoId não pode ser vazio");
    }
    return new CategoriaDeCustoId(valor);
  }

  toString(): string {
    return this.valor;
  }

  igual(outro: CategoriaDeCustoId): boolean {
    return this.valor === outro.valor;
  }
}
