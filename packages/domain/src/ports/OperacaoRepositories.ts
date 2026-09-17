import type { CategoriaDeCusto } from "../operacao/CategoriaDeCusto";
import type { CategoriaDeCustoId } from "../operacao/CategoriaDeCustoId";
import type { Compra } from "../operacao/Compra";
import type { CompraId } from "../operacao/CompraId";
import type { Negocio } from "../operacao/Negocio";
import type { Servico } from "../operacao/Servico";
import type { ServicoId } from "../operacao/ServicoId";

/**
 * Recorte temporal das consultas do contexto de Operação. Os dois
 * limites são inclusivos e opcionais: sem nenhum, é "tudo".
 */
export interface FiltroPeriodo {
  de?: Date;
  ate?: Date;
}

/**
 * O recorte completo de uma listagem de Operação: período mais negócio.
 * Sem `negocio` a consulta atravessa os dois — é o que a visão geral
 * usa, e é a única leitura que tem o direito de fazer isso.
 */
export interface FiltroOperacao extends FiltroPeriodo {
  negocio?: Negocio;
}

export interface CompraRepository {
  salvar(compra: Compra): Promise<void>;
  buscarPorId(id: CompraId): Promise<Compra | null>;
  listar(filtro?: FiltroOperacao): Promise<Compra[]>;
  excluir(id: CompraId): Promise<void>;
}

export interface ServicoRepository {
  salvar(servico: Servico): Promise<void>;
  buscarPorId(id: ServicoId): Promise<Servico | null>;
  listar(filtro?: FiltroOperacao): Promise<Servico[]>;
  excluir(id: ServicoId): Promise<void>;
}

export interface FiltroCategorias {
  incluirArquivadas?: boolean;
}

export interface CategoriaDeCustoRepository {
  salvar(categoria: CategoriaDeCusto): Promise<void>;
  buscarPorId(id: CategoriaDeCustoId): Promise<CategoriaDeCusto | null>;
  buscarPorNome(nome: string): Promise<CategoriaDeCusto | null>;
  listar(filtro?: FiltroCategorias): Promise<CategoriaDeCusto[]>;
}
