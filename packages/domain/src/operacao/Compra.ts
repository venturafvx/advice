import { DomainError } from "../erros/DomainError";
import { CompraId } from "./CompraId";
import { CustoOperacional } from "./CustoOperacional";
import { Dinheiro } from "./Dinheiro";
import { calcularResultado, type ResultadoFinanceiro } from "./ResultadoFinanceiro";

const DESCRICAO_MAX_LENGTH = 200;
const OBSERVACAO_MAX_LENGTH = 2_000;
const QUANTIDADE_MAX = 1_000_000;
/** Teto de linhas de custo: além disso é planilha, não operação. */
const CUSTOS_MAX = 30;

export interface DadosDaCompra {
  descricao: string;
  quantidade: number;
  custoUnitario: Dinheiro;
  precoVendaUnitario: Dinheiro;
  custos: readonly CustoOperacional[];
  compradoEm: Date;
  observacao: string | null;
}

export interface CompraPropsRestauracao extends DadosDaCompra {
  id: CompraId;
  criadoEm: Date;
  atualizadoEm: Date;
}

/**
 * Aggregate root: um lote de mercadoria comprado para revenda, com todos
 * os custos que incidem sobre ele e o preço pelo qual será vendido.
 *
 * A unidade de análise é o **lote**, não o produto: é assim que o
 * dinheiro sai (compra-se 50 peças, paga-se um frete) e é assim que a
 * margem faz sentido. O preço de venda é uma **projeção** — a operação
 * existe para responder "a esse preço, quanto sobra?" antes de comprar.
 *
 * Invariantes:
 * - descrição não vazia, até 200 caracteres
 * - quantidade inteira, de 1 a 1.000.000
 * - custo e preço são `Dinheiro` (inteiros de centavos, não-negativos)
 * - até 30 linhas de custo
 * - data de compra é uma data válida
 */
export class Compra {
  private constructor(
    private readonly id: CompraId,
    private dados: DadosDaCompra,
    private readonly criadoEm: Date,
    private atualizadoEm: Date,
  ) {}

  static criar(dados: DadosDaCompra, agora: Date = new Date()): Compra {
    return new Compra(CompraId.novo(), Compra.validar(dados), agora, agora);
  }

  static restaurar(props: CompraPropsRestauracao): Compra {
    const { id, criadoEm, atualizadoEm, ...dados } = props;
    return new Compra(id, dados, criadoEm, atualizadoEm);
  }

  atualizar(dados: DadosDaCompra, agora: Date = new Date()): void {
    this.dados = Compra.validar(dados);
    this.atualizadoEm = agora;
  }

  /**
   * Todo o painel financeiro da operação. Fica no aggregate (e não numa
   * camada de leitura) porque "qual a margem disto" é regra de negócio,
   * não formatação de tela — o worker, uma API ou um relatório futuro
   * têm de chegar exatamente ao mesmo número.
   */
  calcularResultado(): ResultadoFinanceiro {
    return calcularResultado({
      quantidade: this.dados.quantidade,
      custoUnitarioCentavos: this.dados.custoUnitario.emCentavos(),
      precoVendaUnitarioCentavos: this.dados.precoVendaUnitario.emCentavos(),
      custos: this.dados.custos.map((custo) => ({
        rotulo: custo.getCategoriaNome(),
        modo: custo.getModo(),
        valor: custo.getValor(),
      })),
    });
  }

  getId(): CompraId {
    return this.id;
  }

  getDados(): Readonly<DadosDaCompra> {
    return this.dados;
  }

  getCriadoEm(): Date {
    return new Date(this.criadoEm.getTime());
  }

  getAtualizadoEm(): Date {
    return new Date(this.atualizadoEm.getTime());
  }

  private static validar(dados: DadosDaCompra): DadosDaCompra {
    const descricao = dados.descricao.trim();
    if (descricao.length === 0) {
      throw new DomainError("Descreva o que foi comprado");
    }
    if (descricao.length > DESCRICAO_MAX_LENGTH) {
      throw new DomainError(`A descrição não pode ter mais que ${DESCRICAO_MAX_LENGTH} caracteres`);
    }
    if (!Number.isSafeInteger(dados.quantidade) || dados.quantidade < 1) {
      throw new DomainError("A quantidade precisa ser um número inteiro de pelo menos 1");
    }
    if (dados.quantidade > QUANTIDADE_MAX) {
      throw new DomainError(`A quantidade não pode passar de ${QUANTIDADE_MAX}`);
    }
    if (Number.isNaN(dados.compradoEm.getTime())) {
      throw new DomainError("A data da compra é inválida");
    }
    if (dados.custos.length > CUSTOS_MAX) {
      throw new DomainError(`Uma compra não pode ter mais que ${CUSTOS_MAX} linhas de custo`);
    }

    const observacao = dados.observacao?.trim() ?? null;
    if (observacao !== null && observacao.length > OBSERVACAO_MAX_LENGTH) {
      throw new DomainError(`A observação não pode ter mais que ${OBSERVACAO_MAX_LENGTH} caracteres`);
    }

    return {
      ...dados,
      descricao,
      custos: [...dados.custos],
      observacao: observacao !== null && observacao.length > 0 ? observacao : null,
    };
  }
}
