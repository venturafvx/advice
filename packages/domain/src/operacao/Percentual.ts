import { DomainError } from "../erros/DomainError";

/** 100% expresso em pontos-base (1 ponto-base = 0,01%). */
export const PONTOS_BASE_EM_CEM_PORCENTO = 10_000;

/**
 * Value object de percentual, guardado em **pontos-base inteiros** pela
 * mesma razão que `Dinheiro` guarda centavos: uma taxa de 15% escrita
 * como `0.15` em float vira erro de arredondamento assim que multiplica
 * uma receita. 15% aqui é `1500`.
 */
export class Percentual {
  private constructor(private readonly pontosBase: number) {}

  static zero(): Percentual {
    return new Percentual(0);
  }

  static dePontosBase(pontosBase: number): Percentual {
    if (!Number.isSafeInteger(pontosBase)) {
      throw new DomainError("Percentual precisa ser um número inteiro de pontos-base");
    }
    if (pontosBase < 0) {
      throw new DomainError("Percentual não pode ser negativo");
    }
    if (pontosBase > PONTOS_BASE_EM_CEM_PORCENTO) {
      throw new DomainError("Percentual não pode passar de 100%");
    }
    return new Percentual(pontosBase);
  }

  emPontosBase(): number {
    return this.pontosBase;
  }

  comoFracao(): number {
    return this.pontosBase / PONTOS_BASE_EM_CEM_PORCENTO;
  }
}
