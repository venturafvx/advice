import { randomUUID } from "node:crypto";
import { CategoriaDeCustoId, CustoOperacional } from "@advice/domain";
import type { ModoDeCusto } from "@advice/domain";

export interface LinhaDeCustoLida {
  categoriaId: string;
  categoriaNome: string;
  modo: string;
  valor: number;
}

/**
 * Mapeamento compartilhado entre `custos_compra` e `custos_servico`:
 * as duas tabelas têm a mesma forma porque guardam o mesmo value object
 * (`CustoOperacional`) — o que muda é só a coluna de dono. Tabelas
 * separadas (em vez de uma polimórfica) preservam a integridade
 * referencial, que é o ponto: um custo órfão é dinheiro que some do
 * relatório.
 */
export function custoParaDominio(linha: LinhaDeCustoLida): CustoOperacional {
  return CustoOperacional.criar(
    CategoriaDeCustoId.de(linha.categoriaId),
    linha.categoriaNome,
    linha.modo as ModoDeCusto,
    linha.valor,
  );
}

export function custoParaLinha<Chave extends string>(
  chaveDoDono: Chave,
  idDoDono: string,
  custos: readonly CustoOperacional[],
): ({ id: string; categoriaId: string; modo: string; valor: number; ordem: number } & Record<
  Chave,
  string
>)[] {
  return custos.map((custo, indice) => ({
    id: randomUUID(),
    [chaveDoDono]: idDoDono,
    categoriaId: custo.getCategoriaId().toString(),
    modo: custo.getModo(),
    valor: custo.getValor(),
    // `ordem` preserva a sequência em que o fundador montou os custos —
    // sem ela, a lista se reordena sozinha a cada leitura.
    ordem: indice,
  })) as ({ id: string; categoriaId: string; modo: string; valor: number; ordem: number } & Record<
    Chave,
    string
  >)[];
}

export function agruparPorDono<T extends LinhaDeCustoLida>(
  linhas: T[],
  donoDe: (linha: T) => string,
): Map<string, CustoOperacional[]> {
  const mapa = new Map<string, CustoOperacional[]>();
  for (const linha of linhas) {
    const chave = donoDe(linha);
    const lista = mapa.get(chave);
    const custo = custoParaDominio(linha);
    if (lista) {
      lista.push(custo);
    } else {
      mapa.set(chave, [custo]);
    }
  }
  return mapa;
}
