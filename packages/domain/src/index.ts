export { Lembrete } from "./lembrete/Lembrete";
export type { LembretePropsRestauracao } from "./lembrete/Lembrete";
export { LembreteId } from "./lembrete/LembreteId";
export { StatusLembrete, eStatusTerminal } from "./lembrete/StatusLembrete";
export { AgendamentoInfo, TIMEZONE_PADRAO } from "./lembrete/AgendamentoInfo";
export type { LembreteEvento } from "./lembrete/eventos";

export { Envio } from "./envio/Envio";
export type { EnvioProps } from "./envio/Envio";
export { EnvioId } from "./envio/EnvioId";
export { StatusEnvio } from "./envio/StatusEnvio";

export { Dinheiro } from "./operacao/Dinheiro";
export { Percentual, PONTOS_BASE_EM_CEM_PORCENTO } from "./operacao/Percentual";
export { ModoDeCusto, MODOS_DE_CUSTO, ehModoDeCusto, ehModoPercentual } from "./operacao/ModoDeCusto";
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
export type { LembreteRepository, FiltroLembretes } from "./ports/LembreteRepository";
export type { EnvioRepository } from "./ports/EnvioRepository";
export type {
  CompraRepository,
  ServicoRepository,
  CategoriaDeCustoRepository,
  FiltroPeriodo,
  FiltroCategorias,
} from "./ports/OperacaoRepositories";

export { DomainError, TransicaoInvalidaError } from "./erros/DomainError";
