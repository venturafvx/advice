import { DiaCivil, TIMEZONE_PADRAO, calcularDesempenho } from "@advice/domain";
import type { Habito, HabitoRepository, RegistroDeHabito, RegistroDeHabitoRepository } from "@advice/domain";
import type { DiaDaSemanaDto, HabitoDto, PainelDeHabitosDto, QuebraDto } from "./dtos";

export interface ConsultarHabitosDeps {
  habitoRepository: HabitoRepository;
  registroRepository: RegistroDeHabitoRepository;
}

/**
 * Quanto passado o painel carrega.
 *
 * Pouco mais de um ano, que é exatamente o teto da caminhada de
 * sequência no domínio (366 dias). Carregar menos faria o número mentir
 * por baixo numa sequência longa; carregar mais não mudaria resposta
 * nenhuma.
 */
export const JANELA_DO_PAINEL_EM_DIAS = 400;

/** Quantas quebras com relato o diário mostra. Isto cresce uma por recaída, para sempre. */
export const LIMITE_DE_QUEBRAS = 20;

const DIAS_NA_SEMANA = 7;

/**
 * Monta a tela inteira numa passada: duas consultas, não uma por hábito.
 *
 * A sequência e a aderência saem de `calcularDesempenho`, o mesmo código
 * que o browser roda — nunca de um `COUNT` em SQL. Um segundo lugar
 * calculando isso seria um segundo número, e os dois pareceriam certos.
 */
export async function montarPainelDeHabitos(
  deps: ConsultarHabitosDeps,
  agora: Date = new Date(),
): Promise<PainelDeHabitosDto> {
  const hoje = DiaCivil.hoje(TIMEZONE_PADRAO, agora);

  const [habitos, registros, quebras] = await Promise.all([
    deps.habitoRepository.listar({ incluirArquivados: true }),
    deps.registroRepository.listarDesde(hoje.somarDias(-(JANELA_DO_PAINEL_EM_DIAS - 1))),
    deps.registroRepository.listarQuebrasComRelato(LIMITE_DE_QUEBRAS),
  ]);

  const porHabito = agruparPorHabito(registros);
  const nomes = new Map(habitos.map((habito) => [habito.getId().toString(), habito.getNome()]));

  return {
    hoje: hoje.toString(),
    habitos: habitos.map((habito) => paraDto(habito, porHabito.get(habito.getId().toString()) ?? [], hoje)),
    quebras: quebras.map((quebra) => paraQuebraDto(quebra, nomes)),
  };
}

function agruparPorHabito(registros: readonly RegistroDeHabito[]): Map<string, RegistroDeHabito[]> {
  const mapa = new Map<string, RegistroDeHabito[]>();
  for (const registro of registros) {
    const chave = registro.getHabitoId().toString();
    const lista = mapa.get(chave);
    if (lista) {
      lista.push(registro);
    } else {
      mapa.set(chave, [registro]);
    }
  }
  return mapa;
}

function paraDto(habito: Habito, registros: readonly RegistroDeHabito[], hoje: DiaCivil): HabitoDto {
  const cadencia = habito.getCadencia();
  const porDia = new Map(registros.map((registro) => [registro.getDia().toString(), registro]));

  const desempenho = calcularDesempenho({
    cadencia,
    registros: registros.map((registro) => ({
      dia: registro.getDia().toString(),
      situacao: registro.getSituacao(),
    })),
    hoje,
    // Nada é cobrado antes de o hábito existir: sem isto, um hábito
    // criado ontem nasceria com 3% de aderência e 29 faltas.
    desde: DiaCivil.doInstante(habito.getCriadoEm(), TIMEZONE_PADRAO),
  });

  const registroDeHoje = porDia.get(hoje.toString()) ?? null;

  return {
    id: habito.getId().toString(),
    nome: habito.getNome(),
    motivacao: habito.getMotivacao(),
    cadencia: cadencia.paraProps(),
    arquivado: habito.estaArquivado(),
    criadoEm: habito.getCriadoEm().toISOString(),
    desempenho,
    semana: montarSemana(habito, porDia, hoje),
    hoje: registroDeHoje
      ? {
          dia: registroDeHoje.getDia().toString(),
          situacao: registroDeHoje.getSituacao(),
          observacao: registroDeHoje.getObservacao(),
          pensamento: registroDeHoje.getPensamento(),
        }
      : null,
  };
}

/**
 * A semana corrente, de segunda a domingo.
 *
 * `futuro` existe para a tela não pintar de falha um dia que ainda não
 * chegou — quarta-feira em branco numa segunda não é nada, e mostrá-la
 * igual a uma quarta passada em branco seria acusar sem fato.
 */
function montarSemana(
  habito: Habito,
  porDia: Map<string, RegistroDeHabito>,
  hoje: DiaCivil,
): DiaDaSemanaDto[] {
  const inicio = hoje.inicioDaSemana();

  return Array.from({ length: DIAS_NA_SEMANA }, (_, posicao) => {
    const dia = inicio.somarDias(posicao);
    return {
      dia: dia.toString(),
      exigido: habito.exigeDia(dia),
      situacao: porDia.get(dia.toString())?.getSituacao() ?? null,
      futuro: dia.ehDepoisDe(hoje),
    };
  });
}

function paraQuebraDto(quebra: RegistroDeHabito, nomes: Map<string, string>): QuebraDto {
  const habitoId = quebra.getHabitoId().toString();
  return {
    habitoId,
    // O hábito pode ter sido arquivado depois da quebra — o relato
    // continua valendo, e sem o nome ele viraria um texto sem dono.
    habitoNome: nomes.get(habitoId) ?? "Hábito removido",
    dia: quebra.getDia().toString(),
    observacao: quebra.getObservacao(),
    pensamento: quebra.getPensamento(),
  };
}
