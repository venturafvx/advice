import { Cadencia } from "./Cadencia";
import { DiaCivil } from "./DiaCivil";
import { SituacaoDoDia } from "./SituacaoDoDia";

/** O mínimo que a conta precisa saber de um registro: que dia, e o quê. */
export interface DiaDeclarado {
  /** `YYYY-MM-DD`. */
  dia: string;
  situacao: SituacaoDoDia;
}

export interface EntradaDeDesempenho {
  cadencia: Cadencia;
  registros: readonly DiaDeclarado[];
  hoje: DiaCivil;
  /**
   * O dia em que o hábito passou a existir.
   *
   * Limita a **aderência**, não a sequência: antes dele não havia o que
   * cobrar, então esses dias não entram como devidos. A sequência não se
   * importa — ela olha o que foi declarado, e um dia preenchido
   * retroativamente conta como qualquer outro.
   */
  desde: DiaCivil;
  /** Tamanho da janela de aderência. Para meta flexível é arredondado para semanas fechadas. */
  janelaEmDias?: number;
}

export interface DesempenhoDoHabito {
  /** Quantos dias (ou semanas) seguidos cumpridos, terminando em hoje. */
  sequencia: number;
  unidadeDaSequencia: "DIAS" | "SEMANAS";
  /** O que já foi declarado hoje, se algo foi. */
  situacaoDeHoje: SituacaoDoDia | null;
  /** Hoje ainda espera uma resposta? É isto que põe o hábito na lista de hoje. */
  cobrarHoje: boolean;
  feitosNaSemana: number;
  metaSemanal: number;
  /** Cumpridos, quebrados e cobrados dentro da janela de aderência. */
  feitos: number;
  quebras: number;
  devidos: number;
  /** `feitos / devidos`, ou `null` quando ainda não houve nada a cobrar. */
  aderencia: number | null;
  /** Como a janela foi de fato medida — o rótulo da tela sai daqui. */
  janela: { tamanho: number; unidade: "DIAS" | "SEMANAS" };
}

const JANELA_PADRAO_EM_DIAS = 30;
const DIAS_NA_SEMANA = 7;
/** Teto da caminhada para trás. Uma sequência maior que isso é comemoração, não cálculo. */
const LIMITE_DE_SEQUENCIA_EM_DIAS = 366;
const LIMITE_DE_SEQUENCIA_EM_SEMANAS = 53;

/**
 * A única fonte da sequência e da aderência de um hábito.
 *
 * Roda nos dois lados — servidor e browser — pela mesma razão que
 * `calcularResultado()` roda: o número tem de ser sempre o mesmo. Uma
 * segunda implementação em SQL, ou na tela, seria a garantia de que um
 * dia eles discordariam, e nenhum dos dois pareceria errado.
 *
 * Duas decisões de contagem que valem ser ditas em voz alta:
 *
 * 1. **Dia devido sem registro interrompe a sequência.** A sequência é o
 *    que foi cumprido *e declarado*, não o que se lembra de ter feito.
 *    Tratar silêncio como acerto tornaria o número uma cortesia.
 *
 * 2. **Hoje só conta contra quando já foi declarado.** Enquanto o dia não
 *    acabou, não há falha a registrar — a sequência de ontem continua de
 *    pé e a aderência não conta hoje entre os devidos.
 */
export function calcularDesempenho(entrada: EntradaDeDesempenho): DesempenhoDoHabito {
  const { cadencia, hoje, desde } = entrada;
  const porDia = new Map(entrada.registros.map((registro) => [registro.dia, registro.situacao]));
  const janelaEmDias = entrada.janelaEmDias ?? JANELA_PADRAO_EM_DIAS;
  const situacaoDeHoje = porDia.get(hoje.toString()) ?? null;
  const metaSemanal = cadencia.metaSemanal();
  const feitosNaSemana = contarFeitosNaSemana(porDia, hoje.inicioDaSemana(), hoje);

  return cadencia.ehFlexivel()
    ? desempenhoFlexivel({ porDia, cadencia, hoje, desde, janelaEmDias, situacaoDeHoje, metaSemanal, feitosNaSemana })
    : desempenhoPorDia({ porDia, cadencia, hoje, desde, janelaEmDias, situacaoDeHoje, metaSemanal, feitosNaSemana });
}

interface Contexto {
  porDia: Map<string, SituacaoDoDia>;
  cadencia: Cadencia;
  hoje: DiaCivil;
  desde: DiaCivil;
  janelaEmDias: number;
  situacaoDeHoje: SituacaoDoDia | null;
  metaSemanal: number;
  feitosNaSemana: number;
}

/** DIARIA e DIAS_DA_SEMANA: a unidade é o dia devido. */
function desempenhoPorDia(ctx: Contexto): DesempenhoDoHabito {
  const { porDia, cadencia, hoje, desde, janelaEmDias, situacaoDeHoje } = ctx;

  let sequencia = 0;
  let cursor = hoje;

  if (cadencia.exigeDia(hoje)) {
    if (situacaoDeHoje === SituacaoDoDia.QUEBRADO) {
      // Quebrou hoje: a sequência é zero agora, não ontem.
      sequencia = -1;
    } else if (situacaoDeHoje === SituacaoDoDia.FEITO) {
      sequencia = 1;
    }
  }

  if (sequencia >= 0) {
    cursor = hoje.somarDias(-1);
    for (let passo = 0; passo < LIMITE_DE_SEQUENCIA_EM_DIAS; passo++) {
      // Sem parada em `desde`: quem registrou os três dias anteriores ao
      // criar o hábito hoje cumpriu três dias, e a sequência tem de
      // dizer isso. A caminhada já para sozinha no primeiro dia cobrado
      // sem FEITO — inclusive em todos os dias anteriores à criação, que
      // por definição não têm registro nenhum.
      if (cadencia.exigeDia(cursor)) {
        if (porDia.get(cursor.toString()) !== SituacaoDoDia.FEITO) break;
        sequencia++;
      }
      cursor = cursor.somarDias(-1);
    }
  }

  // Hoje entra na janela só depois de declarado — ver a nota 2 acima.
  const fim = situacaoDeHoje === null ? hoje.somarDias(-1) : hoje;
  const inicioPelaJanela = hoje.somarDias(-(janelaEmDias - 1));
  const inicio = inicioPelaJanela.ehAntesDe(desde) ? desde : inicioPelaJanela;

  let feitos = 0;
  let quebras = 0;
  let devidos = 0;
  for (let dia = inicio; !dia.ehDepoisDe(fim); dia = dia.somarDias(1)) {
    if (!cadencia.exigeDia(dia)) continue;
    devidos++;
    const situacao = porDia.get(dia.toString());
    if (situacao === SituacaoDoDia.FEITO) feitos++;
    if (situacao === SituacaoDoDia.QUEBRADO) quebras++;
  }

  return {
    sequencia: Math.max(sequencia, 0),
    unidadeDaSequencia: "DIAS",
    situacaoDeHoje,
    cobrarHoje: situacaoDeHoje === null && cadencia.exigeDia(hoje),
    feitosNaSemana: ctx.feitosNaSemana,
    metaSemanal: ctx.metaSemanal,
    feitos,
    quebras,
    devidos,
    aderencia: devidos === 0 ? null : feitos / devidos,
    janela: { tamanho: janelaEmDias, unidade: "DIAS" },
  };
}

/**
 * VEZES_POR_SEMANA: a unidade é a semana.
 *
 * Contar esse hábito em dias daria um número sem sentido — "3x por
 * semana" não tem dia devido, então toda terça sem treino pareceria
 * falha. A sequência conta semanas que bateram a meta, e a aderência
 * olha só semanas **fechadas**: a semana corrente ainda está sendo
 * jogada, e incluí-la puxaria a aderência para baixo toda segunda-feira.
 */
function desempenhoFlexivel(ctx: Contexto): DesempenhoDoHabito {
  const { porDia, hoje, desde, janelaEmDias, situacaoDeHoje, metaSemanal, feitosNaSemana } = ctx;

  const semanaAtual = hoje.inicioDaSemana();
  let sequencia = feitosNaSemana >= metaSemanal ? 1 : 0;

  for (let passo = 0; passo < LIMITE_DE_SEQUENCIA_EM_SEMANAS; passo++) {
    const inicio = semanaAtual.somarDias(-DIAS_NA_SEMANA * (passo + 1));
    // Também sem parada em `desde`, pelo mesmo motivo: uma semana sem
    // registro não bate a meta e encerra a contagem por si.
    if (contarFeitosNaSemana(porDia, inicio, inicio.somarDias(DIAS_NA_SEMANA - 1)) < metaSemanal) break;
    sequencia++;
  }

  const semanasNaJanela = Math.max(1, Math.floor(janelaEmDias / DIAS_NA_SEMANA));
  let feitos = 0;
  let quebras = 0;
  let semanasCobradas = 0;

  for (let passo = 1; passo <= semanasNaJanela; passo++) {
    const inicio = semanaAtual.somarDias(-DIAS_NA_SEMANA * passo);
    const fim = inicio.somarDias(DIAS_NA_SEMANA - 1);
    // A semana em que o hábito nasceu sai inteira da conta: cobrar 3
    // idas numa semana em que ele existiu por dois dias seria uma
    // aderência baixa por um motivo que não é comportamento.
    if (inicio.ehAntesDe(desde)) break;
    semanasCobradas++;
    for (let dia = inicio; !dia.ehDepoisDe(fim); dia = dia.somarDias(1)) {
      const situacao = porDia.get(dia.toString());
      if (situacao === SituacaoDoDia.FEITO) feitos++;
      if (situacao === SituacaoDoDia.QUEBRADO) quebras++;
    }
  }

  const devidos = semanasCobradas * metaSemanal;

  return {
    sequencia,
    unidadeDaSequencia: "SEMANAS",
    situacaoDeHoje,
    // Meta batida encerra a cobrança da semana: insistir depois de
    // cumprido transformaria "3x por semana" em sete cobranças.
    cobrarHoje: situacaoDeHoje === null && feitosNaSemana < metaSemanal,
    feitosNaSemana,
    metaSemanal,
    feitos,
    quebras,
    devidos,
    // Sem semana fechada ainda: aderência é `null`, não 0% — nunca
    // acusar de falha quem simplesmente acabou de começar.
    aderencia: devidos === 0 ? null : Math.min(feitos / devidos, 1),
    janela: { tamanho: semanasCobradas, unidade: "SEMANAS" },
  };
}

function contarFeitosNaSemana(
  porDia: Map<string, SituacaoDoDia>,
  inicio: DiaCivil,
  ate: DiaCivil,
): number {
  let feitos = 0;
  for (let dia = inicio; !dia.ehDepoisDe(ate); dia = dia.somarDias(1)) {
    if (porDia.get(dia.toString()) === SituacaoDoDia.FEITO) feitos++;
  }
  return feitos;
}
