import { CategoriaDeCusto, CategoriaDeCustoId } from "@advice/domain";
import type { CategoriaDeCustoRepository, ModoDeCusto } from "@advice/domain";
import type { CategoriaDeCustoDto } from "./dtos";
import { CategoriaDeCustoDuplicadaError, CategoriaDeCustoNaoEncontradaError } from "./erros";
import { categoriaParaDto } from "./mapeadores";

export interface CategoriaDeCustoInput {
  nome: string;
  modoPadrao: ModoDeCusto;
  valorPadrao: number | null;
}

export interface CategoriaDeCustoDeps {
  categoriaRepository: CategoriaDeCustoRepository;
}

export async function listarCategoriasDeCusto(
  deps: CategoriaDeCustoDeps,
  incluirArquivadas = false,
): Promise<CategoriaDeCustoDto[]> {
  const categorias = await deps.categoriaRepository.listar({ incluirArquivadas });
  return categorias.map(categoriaParaDto);
}

export async function criarCategoriaDeCusto(
  input: CategoriaDeCustoInput,
  deps: CategoriaDeCustoDeps,
): Promise<CategoriaDeCustoDto> {
  // O banco tem índice único case-insensitive no nome; esta checagem
  // existe para devolver um erro de negócio legível em vez de um erro
  // de constraint cru. A garantia dura continua sendo a do banco.
  const existente = await deps.categoriaRepository.buscarPorNome(input.nome);
  if (existente) {
    throw new CategoriaDeCustoDuplicadaError(input.nome);
  }

  const categoria = CategoriaDeCusto.criar(input.nome, input.modoPadrao, input.valorPadrao);
  await deps.categoriaRepository.salvar(categoria);
  return categoriaParaDto(categoria);
}

export async function atualizarCategoriaDeCusto(
  id: string,
  input: CategoriaDeCustoInput,
  deps: CategoriaDeCustoDeps,
): Promise<CategoriaDeCustoDto> {
  const categoria = await carregar(id, deps);

  const conflito = await deps.categoriaRepository.buscarPorNome(input.nome);
  if (conflito && !conflito.getId().igual(categoria.getId())) {
    throw new CategoriaDeCustoDuplicadaError(input.nome);
  }

  categoria.renomear(input.nome);
  categoria.definirPadrao(input.modoPadrao, input.valorPadrao);
  await deps.categoriaRepository.salvar(categoria);
  return categoriaParaDto(categoria);
}

/**
 * Arquiva em vez de excluir: operações já registradas continuam
 * apontando para a categoria, e apagá-la deixaria o histórico
 * financeiro sem o rótulo do que foi gasto. Arquivada, ela só some da
 * lista de escolhas do formulário.
 */
export async function arquivarCategoriaDeCusto(
  id: string,
  arquivar: boolean,
  deps: CategoriaDeCustoDeps,
): Promise<CategoriaDeCustoDto> {
  const categoria = await carregar(id, deps);
  if (arquivar) {
    categoria.arquivar();
  } else {
    categoria.reativar();
  }
  await deps.categoriaRepository.salvar(categoria);
  return categoriaParaDto(categoria);
}

async function carregar(id: string, deps: CategoriaDeCustoDeps): Promise<CategoriaDeCusto> {
  const categoria = await deps.categoriaRepository.buscarPorId(CategoriaDeCustoId.de(id));
  if (!categoria) {
    throw new CategoriaDeCustoNaoEncontradaError(id);
  }
  return categoria;
}
