import { DomainError } from "../erros/DomainError";
import { CustoOperacional } from "./CustoOperacional";
import { Dinheiro } from "./Dinheiro";
import { ModoDeCusto } from "./ModoDeCusto";
import { ehNegocio, type Negocio } from "./Negocio";
import { ServicoId } from "./ServicoId";
import { calcularResultado, type ResultadoFinanceiro } from "./ResultadoFinanceiro";

const DESCRICAO_MAX_LENGTH = 200;
const CLIENTE_MAX_LENGTH = 120;
const OBSERVACAO_MAX_LENGTH = 2_000;
const CUSTOS_MAX = 30;

export interface DadosDoServico {
  negocio: Negocio;
  descricao: string;
  cliente: string | null;
  valorRecebido: Dinheiro;
  custos: readonly CustoOperacional[];
  recebidoEm: Date;
  observacao: string | null;
}

export interface ServicoPropsRestauracao extends DadosDoServico {
  id: ServicoId;
  criadoEm: Date;
  atualizadoEm: Date;
}

/**
 * Aggregate root: um serviço prestado e recebido — hoje, a venda e
 * instalação de papel de parede.
 *
 * Diferente da Compra, aqui a receita é **realizada**, não projetada:
 * o valor já entrou. Por isso não há quantidade nem preço de venda —
 * há o que foi recebido, e o que saiu para entregar (material,
 * deslocamento, comissão).
 *
 * Custos por unidade não se aplicam: um serviço é um trabalho, não um
 * lote — e aceitar esse modo produziria um número que não significa
 * nada. A invariante rejeita na fronteira.
 */
export class Servico {
  private constructor(
    private readonly id: ServicoId,
    private dados: DadosDoServico,
    private readonly criadoEm: Date,
    private atualizadoEm: Date,
  ) {}

  static criar(dados: DadosDoServico, agora: Date = new Date()): Servico {
    return new Servico(ServicoId.novo(), Servico.validar(dados), agora, agora);
  }

  static restaurar(props: ServicoPropsRestauracao): Servico {
    const { id, criadoEm, atualizadoEm, ...dados } = props;
    return new Servico(id, dados, criadoEm, atualizadoEm);
  }

  atualizar(dados: DadosDoServico, agora: Date = new Date()): void {
    this.dados = Servico.validar(dados);
    this.atualizadoEm = agora;
  }

  /**
   * Mesma matemática da Compra, com quantidade 1 e CMV zero: o valor
   * recebido é a receita bruta, e o que sobra depois dos custos é o
   * lucro. Reusar o cálculo é o que permite somar serviço e mercadoria
   * no mesmo resumo sem dois conceitos de "margem".
   */
  calcularResultado(): ResultadoFinanceiro {
    return calcularResultado({
      quantidade: 1,
      custoUnitarioCentavos: 0,
      precoVendaUnitarioCentavos: this.dados.valorRecebido.emCentavos(),
      custos: this.dados.custos.map((custo) => ({
        rotulo: custo.getCategoriaNome(),
        modo: custo.getModo(),
        valor: custo.getValor(),
      })),
    });
  }

  getId(): ServicoId {
    return this.id;
  }

  getDados(): Readonly<DadosDoServico> {
    return this.dados;
  }

  getCriadoEm(): Date {
    return new Date(this.criadoEm.getTime());
  }

  getAtualizadoEm(): Date {
    return new Date(this.atualizadoEm.getTime());
  }

  private static validar(dados: DadosDoServico): DadosDoServico {
    if (!ehNegocio(dados.negocio)) {
      throw new DomainError("Escolha a qual negócio este serviço pertence");
    }

    const descricao = dados.descricao.trim();
    if (descricao.length === 0) {
      throw new DomainError("Descreva o serviço prestado");
    }
    if (descricao.length > DESCRICAO_MAX_LENGTH) {
      throw new DomainError(`A descrição não pode ter mais que ${DESCRICAO_MAX_LENGTH} caracteres`);
    }
    if (Number.isNaN(dados.recebidoEm.getTime())) {
      throw new DomainError("A data de recebimento é inválida");
    }
    if (dados.custos.length > CUSTOS_MAX) {
      throw new DomainError(`Um serviço não pode ter mais que ${CUSTOS_MAX} linhas de custo`);
    }
    if (dados.custos.some((custo) => custo.getModo() === ModoDeCusto.POR_UNIDADE)) {
      throw new DomainError("Custo por unidade não se aplica a um serviço — use valor fixo ou percentual");
    }

    const cliente = dados.cliente?.trim() ?? null;
    if (cliente !== null && cliente.length > CLIENTE_MAX_LENGTH) {
      throw new DomainError(`O nome do cliente não pode ter mais que ${CLIENTE_MAX_LENGTH} caracteres`);
    }

    const observacao = dados.observacao?.trim() ?? null;
    if (observacao !== null && observacao.length > OBSERVACAO_MAX_LENGTH) {
      throw new DomainError(`A observação não pode ter mais que ${OBSERVACAO_MAX_LENGTH} caracteres`);
    }

    return {
      ...dados,
      descricao,
      cliente: cliente !== null && cliente.length > 0 ? cliente : null,
      custos: [...dados.custos],
      observacao: observacao !== null && observacao.length > 0 ? observacao : null,
    };
  }
}
