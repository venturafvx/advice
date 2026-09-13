import { CategoriaDeCustoId, CustoOperacional } from "@advice/domain";
import type { CategoriaDeCustoRepository } from "@advice/domain";
import type { CustoEntrada } from "./dtos";
import { CategoriaDeCustoNaoEncontradaError } from "./erros";

/**
 * Converte as linhas cruas do formulário em value objects, resolvendo o
 * nome de cada categoria contra o repositório.
 *
 * Faz uma leitura só (`listar`) em vez de um `buscarPorId` por linha:
 * o número de categorias é pequeno e fixo, e o N+1 aqui seria uma ida ao
 * banco por linha de custo de cada operação salva.
 */
export async function montarCustos(
  entradas: readonly CustoEntrada[],
  categoriaRepository: CategoriaDeCustoRepository,
): Promise<CustoOperacional[]> {
  if (entradas.length === 0) {
    return [];
  }

  const categorias = await categoriaRepository.listar({ incluirArquivadas: true });
  const nomePorId = new Map(categorias.map((c) => [c.getId().toString(), c.getNome()]));

  return entradas.map((entrada) => {
    const nome = nomePorId.get(entrada.categoriaId);
    if (nome === undefined) {
      throw new CategoriaDeCustoNaoEncontradaError(entrada.categoriaId);
    }
    return CustoOperacional.criar(
      CategoriaDeCustoId.de(entrada.categoriaId),
      nome,
      entrada.modo,
      entrada.valor,
    );
  });
}
