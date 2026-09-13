import { DomainError } from "../erros/DomainError";
import { CategoriaDeCustoId } from "./CategoriaDeCustoId";
import { Dinheiro } from "./Dinheiro";
import { ModoDeCusto, ehModoPercentual } from "./ModoDeCusto";
import { Percentual } from "./Percentual";

export interface CustoOperacionalProps {
  categoriaId: CategoriaDeCustoId;
  /**
   * Nome da categoria no momento da leitura — projeção, não estado.
   * O custo referencia a categoria só pelo id (regra de um aggregate
   * nunca guardar outro por valor); o repositório resolve o nome no
   * join. Renomear uma categoria reflete em todo o histórico, que é o
   * comportamento certo: é a mesma categoria, com outro rótulo.
   */
  categoriaNome: string;
  modo: ModoDeCusto;
  /** Centavos quando o modo é monetário; pontos-base quando percentual. */
  valor: number;
}

/**
 * Uma linha de custo de uma operação: "Taxa Amazon, 15% da venda",
 * "Frete, R$ 120 fixos", "Etiquetagem, R$ 0,80 por unidade".
 *
 * Value object — não tem identidade própria, vive dentro do aggregate
 * (Compra ou Serviço) que o contém.
 */
export class CustoOperacional {
  private constructor(private readonly props: CustoOperacionalProps) {}

  static criar(
    categoriaId: CategoriaDeCustoId,
    categoriaNome: string,
    modo: ModoDeCusto,
    valor: number,
  ): CustoOperacional {
    const nome = categoriaNome.trim();
    if (nome.length === 0) {
      throw new DomainError("Custo precisa de uma categoria com nome");
    }

    // Valida o número pela régua do próprio modo: percentual passa por
    // Percentual (0–100%), monetário passa por Dinheiro (inteiro ≥ 0).
    if (ehModoPercentual(modo)) {
      Percentual.dePontosBase(valor);
    } else {
      Dinheiro.deCentavos(valor);
    }

    return new CustoOperacional({ categoriaId, categoriaNome: nome, modo, valor });
  }

  getCategoriaId(): CategoriaDeCustoId {
    return this.props.categoriaId;
  }

  getCategoriaNome(): string {
    return this.props.categoriaNome;
  }

  getModo(): ModoDeCusto {
    return this.props.modo;
  }

  getValor(): number {
    return this.props.valor;
  }

  ehPercentual(): boolean {
    return ehModoPercentual(this.props.modo);
  }
}
