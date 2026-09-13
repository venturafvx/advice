import { randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class LembreteId {
  private constructor(private readonly valor: string) {}

  static novo(): LembreteId {
    return new LembreteId(randomUUID());
  }

  static de(valor: string): LembreteId {
    if (!valor || valor.trim().length === 0) {
      throw new DomainError("LembreteId não pode ser vazio");
    }
    return new LembreteId(valor);
  }

  toString(): string {
    return this.valor;
  }

  igual(outro: LembreteId): boolean {
    return this.valor === outro.valor;
  }
}
