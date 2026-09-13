import { DomainError } from "../erros/DomainError";

const CENTAVOS_POR_REAL = 100;

/**
 * Teto defensivo: R$ 1 bilhão. Numa operação pessoal, qualquer valor
 * acima disso é dedo escorregando no teclado, não negócio real — e
 * falhar alto na fronteira é melhor que gravar lixo no banco.
 */
const LIMITE_CENTAVOS = 100_000_000_000;

/**
 * Value object de dinheiro. Guarda **centavos inteiros**, nunca float:
 * `0.1 + 0.2 !== 0.3` em ponto flutuante, e num sistema que existe para
 * calcular margem um centavo errado propaga para toda a conta.
 *
 * Só representa valores **não-negativos** — preço, custo e receita são
 * grandezas positivas por definição. Lucro (que pode ser negativo) não é
 * `Dinheiro`: é um inteiro de centavos com sinal, produzido pelo
 * cálculo em `ResultadoFinanceiro`.
 */
export class Dinheiro {
  private constructor(private readonly centavos: number) {}

  static zero(): Dinheiro {
    return new Dinheiro(0);
  }

  static deCentavos(centavos: number): Dinheiro {
    if (!Number.isSafeInteger(centavos)) {
      throw new DomainError("Valor monetário precisa ser um número inteiro de centavos");
    }
    if (centavos < 0) {
      throw new DomainError("Valor monetário não pode ser negativo");
    }
    if (centavos > LIMITE_CENTAVOS) {
      throw new DomainError("Valor monetário acima do limite aceito");
    }
    return new Dinheiro(centavos);
  }

  static deReais(reais: number): Dinheiro {
    if (!Number.isFinite(reais)) {
      throw new DomainError("Valor monetário inválido");
    }
    return Dinheiro.deCentavos(Math.round(reais * CENTAVOS_POR_REAL));
  }

  emCentavos(): number {
    return this.centavos;
  }

  ehZero(): boolean {
    return this.centavos === 0;
  }

  igual(outro: Dinheiro): boolean {
    return this.centavos === outro.centavos;
  }
}
