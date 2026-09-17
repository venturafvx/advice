import { createHash, randomUUID } from "node:crypto";
import { DomainError } from "../erros/DomainError";

export class LembreteId {
  private constructor(private readonly valor: string) {}

  static novo(): LembreteId {
    return new LembreteId(randomUUID());
  }

  /**
   * Id **determinístico** da ocorrência de uma série recorrente: UUID v5
   * derivado de (série, instante agendado).
   *
   * Isso é o que torna a materialização da próxima ocorrência
   * idempotente. O worker não tem transação abrangendo "marcar como
   * enviado" e "criar a próxima": se o processo morrer entre as duas
   * escritas, o ciclo seguinte refaz o trabalho. Com id aleatório isso
   * criaria um lembrete duplicado — com id determinístico, a segunda
   * gravação é o mesmo `upsert` sobre a mesma linha e não acontece nada.
   */
  static daOcorrencia(serieId: LembreteId, instante: Date): LembreteId {
    const bytes = createHash("sha1").update(`advice:lembrete:${serieId.valor}:${instante.toISOString()}`).digest();

    // RFC 4122: versão 5 nos 4 bits altos do byte 6, variante 10 no byte 8.
    bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
    bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

    const hex = bytes.subarray(0, 16).toString("hex");
    return new LembreteId(
      `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`,
    );
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
