import { FrequenciaDoHabito } from "@advice/domain";
import type { CadenciaProps, DesempenhoDoHabito } from "@advice/domain";
import { descreverDiasDaSemana } from "@/lib/recorrencia";

/** A regra em uma linha de português — o que o fundador lê na lista. */
export function descreverCadencia(cadencia: CadenciaProps): string {
  switch (cadencia.frequencia) {
    case FrequenciaDoHabito.DIARIA:
      return "Todo dia";
    case FrequenciaDoHabito.DIAS_DA_SEMANA:
      return descreverDiasDaSemana(cadencia.diasDaSemana);
    case FrequenciaDoHabito.VEZES_POR_SEMANA:
      return `${cadencia.vezesPorSemana}× por semana`;
  }
}

/**
 * A sequência em palavras.
 *
 * Zero não vira "0 dias": um contador zerado em destaque é o app
 * cutucando a ferida. Quem está começando (ou recomeçando) lê "Comece
 * hoje", que é a única coisa útil a dizer nesse estado.
 */
export function descreverSequencia(desempenho: DesempenhoDoHabito): string {
  const { sequencia, unidadeDaSequencia } = desempenho;
  if (sequencia === 0) return "Comece hoje";

  if (unidadeDaSequencia === "SEMANAS") {
    return sequencia === 1 ? "1 semana em dia" : `${sequencia} semanas em dia`;
  }
  return sequencia === 1 ? "1 dia seguido" : `${sequencia} dias seguidos`;
}

/** `null` vira travessão: hábito recém-criado não tem aderência, e 0% seria uma acusação falsa. */
export function formatarAderencia(desempenho: DesempenhoDoHabito): string {
  if (desempenho.aderencia === null) return "—";
  return `${Math.round(desempenho.aderencia * 100)}%`;
}

/** O rótulo honesto da janela medida: "últimos 30 dias" ou "últimas 4 semanas". */
export function descreverJanela(desempenho: DesempenhoDoHabito): string {
  const { tamanho, unidade } = desempenho.janela;
  if (unidade === "SEMANAS") {
    return tamanho === 1 ? "última semana fechada" : `últimas ${tamanho} semanas fechadas`;
  }
  return `últimos ${tamanho} dias`;
}

/** O que falta na semana de uma meta flexível — "faltam 2 de 3". */
export function descreverProgressoDaSemana(desempenho: DesempenhoDoHabito): string {
  return `${desempenho.feitosNaSemana} de ${desempenho.metaSemanal} nesta semana`;
}

/**
 * O detalhe por trás do percentual, para o `title` do número.
 *
 * Um "73%" sozinho não diz de quantos — e a diferença entre 3 de 4 e 22
 * de 30 é a diferença entre um começo e um padrão.
 */
export function descreverAderencia(desempenho: DesempenhoDoHabito): string {
  if (desempenho.aderencia === null) {
    return "Ainda não houve nada a cobrar";
  }
  const unidade = desempenho.janela.unidade === "SEMANAS" ? "cumpridos nas semanas fechadas" : "dias cobrados";
  return `${desempenho.feitos} de ${desempenho.devidos} ${unidade}`;
}
