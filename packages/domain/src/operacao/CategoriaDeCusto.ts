import { DomainError } from "../erros/DomainError";
import { CategoriaDeCustoId } from "./CategoriaDeCustoId";
import { Dinheiro } from "./Dinheiro";
import { ModoDeCusto, ehModoPercentual } from "./ModoDeCusto";
import { Percentual } from "./Percentual";

const NOME_MAX_LENGTH = 60;

export interface CategoriaDeCustoPropsRestauracao {
  id: CategoriaDeCustoId;
  nome: string;
  modoPadrao: ModoDeCusto;
  valorPadrao: number | null;
  arquivada: boolean;
  criadoEm: Date;
}

/**
 * Aggregate root: um tipo de custo que o fundador reusa entre operações
 * — "Frete", "Etiquetagem", "Taxa Amazon", ou qualquer outro que ele
 * crie.
 *
 * Existe como entidade (e não como texto livre em cada linha de custo)
 * por um motivo concreto: só assim dá para responder "quanto a Amazon
 * levou no trimestre?" ou "quanto gastei de frete?". Texto livre não
 * agrega — vira "Frete", "frete" e "Frete SP" como três coisas.
 *
 * `modoPadrao` e `valorPadrao` são sugestões: escolher "Taxa Amazon"
 * no formulário já preenche 15% da venda. O valor efetivo de cada
 * operação continua sendo dela, não da categoria — mudar o padrão não
 * reescreve histórico.
 */
export class CategoriaDeCusto {
  private constructor(
    private readonly id: CategoriaDeCustoId,
    private nome: string,
    private modoPadrao: ModoDeCusto,
    private valorPadrao: number | null,
    private arquivada: boolean,
    private readonly criadoEm: Date,
  ) {}

  static criar(
    nome: string,
    modoPadrao: ModoDeCusto,
    valorPadrao: number | null,
    agora: Date = new Date(),
  ): CategoriaDeCusto {
    const nomeLimpo = CategoriaDeCusto.validarNome(nome);
    CategoriaDeCusto.validarValorPadrao(modoPadrao, valorPadrao);
    return new CategoriaDeCusto(CategoriaDeCustoId.novo(), nomeLimpo, modoPadrao, valorPadrao, false, agora);
  }

  static restaurar(props: CategoriaDeCustoPropsRestauracao): CategoriaDeCusto {
    return new CategoriaDeCusto(
      props.id,
      props.nome,
      props.modoPadrao,
      props.valorPadrao,
      props.arquivada,
      props.criadoEm,
    );
  }

  renomear(nome: string): void {
    this.nome = CategoriaDeCusto.validarNome(nome);
  }

  definirPadrao(modoPadrao: ModoDeCusto, valorPadrao: number | null): void {
    CategoriaDeCusto.validarValorPadrao(modoPadrao, valorPadrao);
    this.modoPadrao = modoPadrao;
    this.valorPadrao = valorPadrao;
  }

  /**
   * Categoria sai de circulação em vez de ser apagada: operações
   * antigas continuam apontando para ela, e o histórico financeiro não
   * pode perder o rótulo do que foi gasto.
   */
  arquivar(): void {
    this.arquivada = true;
  }

  reativar(): void {
    this.arquivada = false;
  }

  estaArquivada(): boolean {
    return this.arquivada;
  }

  getId(): CategoriaDeCustoId {
    return this.id;
  }

  getNome(): string {
    return this.nome;
  }

  getModoPadrao(): ModoDeCusto {
    return this.modoPadrao;
  }

  getValorPadrao(): number | null {
    return this.valorPadrao;
  }

  getCriadoEm(): Date {
    return new Date(this.criadoEm.getTime());
  }

  private static validarNome(nome: string): string {
    const limpo = nome.trim();
    if (limpo.length === 0) {
      throw new DomainError("A categoria de custo precisa de um nome");
    }
    if (limpo.length > NOME_MAX_LENGTH) {
      throw new DomainError(`O nome da categoria não pode ter mais que ${NOME_MAX_LENGTH} caracteres`);
    }
    return limpo;
  }

  private static validarValorPadrao(modo: ModoDeCusto, valor: number | null): void {
    if (valor === null) {
      return;
    }
    if (ehModoPercentual(modo)) {
      Percentual.dePontosBase(valor);
    } else {
      Dinheiro.deCentavos(valor);
    }
  }
}
