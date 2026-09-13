import type { CategoriaDeCusto } from "../operacao/CategoriaDeCusto";
import type { CategoriaDeCustoId } from "../operacao/CategoriaDeCustoId";
import type { Compra } from "../operacao/Compra";
import type { CompraId } from "../operacao/CompraId";
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

export interface CompraRepository {
  salvar(compra: Compra): Promise<void>;
  buscarPorId(id: CompraId): Promise<Compra | null>;
  listar(filtro?: FiltroPeriodo): Promise<Compra[]>;
  excluir(id: CompraId): Promise<void>;
}

export interface ServicoRepository {
  salvar(servico: Servico): Promise<void>;
  buscarPorId(id: ServicoId): Promise<Servico | null>;
  listar(filtro?: FiltroPeriodo): Promise<Servico[]>;
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
