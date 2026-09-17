export { Lembrete } from "./lembrete/Lembrete";
export type { LembretePropsRestauracao, NovoAgendamento } from "./lembrete/Lembrete";
export { LembreteId } from "./lembrete/LembreteId";
export { StatusLembrete, eStatusTerminal } from "./lembrete/StatusLembrete";
export { AgendamentoInfo, TIMEZONE_PADRAO } from "./lembrete/AgendamentoInfo";
export { Recorrencia, Frequencia, FREQUENCIAS, ehFrequencia } from "./lembrete/Recorrencia";
export type { RecorrenciaProps } from "./lembrete/Recorrencia";
export { partesEmTimezone, instanteDe, diaDaSemanaDe, ultimoDiaDoMes } from "./lembrete/tempo";
export type { PartesDeTempo } from "./lembrete/tempo";
export type { LembreteEvento } from "./lembrete/eventos";

export { Habito, HabitoArquivadoError } from "./habito/Habito";
export type { HabitoPropsRestauracao } from "./habito/Habito";
export { HabitoId } from "./habito/HabitoId";
export { RegistroDeHabito } from "./habito/RegistroDeHabito";
export type { RegistroDeHabitoPropsRestauracao, NotasDoDia } from "./habito/RegistroDeHabito";
export { RegistroDeHabitoId } from "./habito/RegistroDeHabitoId";
export { DiaCivil, INICIO_DA_SEMANA } from "./habito/DiaCivil";
export {
  Cadencia,
  FrequenciaDoHabito,
  FREQUENCIAS_DE_HABITO,
  ehFrequenciaDeHabito,
} from "./habito/Cadencia";
export type { CadenciaProps } from "./habito/Cadencia";
export { SituacaoDoDia, SITUACOES_DO_DIA, ehSituacaoDoDia } from "./habito/SituacaoDoDia";
export { calcularDesempenho } from "./habito/desempenho";
export type { DesempenhoDoHabito, DiaDeclarado, EntradaDeDesempenho } from "./habito/desempenho";

export { Envio } from "./envio/Envio";
export type { EnvioProps } from "./envio/Envio";
export { EnvioId } from "./envio/EnvioId";
export { StatusEnvio } from "./envio/StatusEnvio";

export { Dinheiro } from "./operacao/Dinheiro";
export { Percentual, PONTOS_BASE_EM_CEM_PORCENTO } from "./operacao/Percentual";
export { ModoDeCusto, MODOS_DE_CUSTO, ehModoDeCusto, ehModoPercentual } from "./operacao/ModoDeCusto";
export { Negocio, NEGOCIOS, ehNegocio } from "./operacao/Negocio";
export { CustoOperacional } from "./operacao/CustoOperacional";
export type { CustoOperacionalProps } from "./operacao/CustoOperacional";
export { CategoriaDeCusto } from "./operacao/CategoriaDeCusto";
export type { CategoriaDeCustoPropsRestauracao } from "./operacao/CategoriaDeCusto";
export { CategoriaDeCustoId } from "./operacao/CategoriaDeCustoId";
export { Compra } from "./operacao/Compra";
export type { DadosDaCompra, CompraPropsRestauracao } from "./operacao/Compra";
export { CompraId } from "./operacao/CompraId";
export { Servico } from "./operacao/Servico";
export type { DadosDoServico, ServicoPropsRestauracao } from "./operacao/Servico";
export { ServicoId } from "./operacao/ServicoId";
export { calcularResultado } from "./operacao/ResultadoFinanceiro";
export type {
  EntradaDeCusto,
  EntradaDeCalculo,
  CustoCalculado,
  ResultadoFinanceiro,
} from "./operacao/ResultadoFinanceiro";

export type {
  NotificadorWhatsApp,
  MensagemParaEnvio,
  ResultadoEnvioWhatsApp,
} from "./ports/NotificadorWhatsApp";
export type { LembreteRepository, FiltroLembretes, OpcoesHistorico } from "./ports/LembreteRepository";
export type { EnvioRepository } from "./ports/EnvioRepository";
export type {
  HabitoRepository,
  RegistroDeHabitoRepository,
  FiltroHabitos,
} from "./ports/HabitoRepositories";
export type {
  CompraRepository,
  ServicoRepository,
  CategoriaDeCustoRepository,
  FiltroPeriodo,
  FiltroOperacao,
  FiltroCategorias,
} from "./ports/OperacaoRepositories";

export { DomainError, LembreteImutavelError, TransicaoInvalidaError } from "./erros/DomainError";
