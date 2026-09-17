export { criarLembrete } from "./casos-de-uso/CriarLembrete";
export type {
  CriarLembreteInput,
  CriarLembreteDeps,
  CriarLembreteResultado,
} from "./casos-de-uso/CriarLembrete";

export { cancelarLembrete } from "./casos-de-uso/CancelarLembrete";
export type { CancelarLembreteDeps } from "./casos-de-uso/CancelarLembrete";

export { editarLembrete } from "./casos-de-uso/EditarLembrete";
export type {
  EditarLembreteInput,
  EditarLembreteDeps,
  EditarLembreteResultado,
} from "./casos-de-uso/EditarLembrete";

export { excluirLembrete, limparHistorico } from "./casos-de-uso/ExcluirLembrete";
export type { ExcluirLembreteDeps } from "./casos-de-uso/ExcluirLembrete";

export { LembreteNaoEncontradoError } from "./casos-de-uso/erros";

export {
  listarLembretes,
  listarPendentes,
  listarHistorico,
  LIMITE_HISTORICO_PADRAO,
  LIMITE_HISTORICO_BUSCA,
} from "./casos-de-uso/ListarLembretes";
export type { LembreteResumo, ListarLembretesDeps } from "./casos-de-uso/ListarLembretes";

export { processarLembretesPendentes } from "./casos-de-uso/ProcessarLembretesPendentes";
export type {
  ProcessarLembretesDeps,
  ProcessarLembretesResultado,
} from "./casos-de-uso/ProcessarLembretesPendentes";

export type {
  CustoDto,
  CustoEntrada,
  CompraDto,
  ServicoDto,
  CategoriaDeCustoDto,
} from "./casos-de-uso/operacao/dtos";

export {
  CompraNaoEncontradaError,
  ServicoNaoEncontradoError,
  CategoriaDeCustoNaoEncontradaError,
  CategoriaDeCustoDuplicadaError,
} from "./casos-de-uso/operacao/erros";

export { registrarCompra, atualizarCompra, excluirCompra } from "./casos-de-uso/operacao/RegistrarCompra";
export type { CompraInput, CompraDeps } from "./casos-de-uso/operacao/RegistrarCompra";

export { listarCompras, buscarCompra } from "./casos-de-uso/operacao/ConsultarCompras";
export type { ConsultarComprasDeps } from "./casos-de-uso/operacao/ConsultarCompras";

export { registrarServico, atualizarServico, excluirServico } from "./casos-de-uso/operacao/RegistrarServico";
export type { ServicoInput, ServicoDeps } from "./casos-de-uso/operacao/RegistrarServico";

export { listarServicos, buscarServico } from "./casos-de-uso/operacao/ConsultarServicos";
export type { ConsultarServicosDeps } from "./casos-de-uso/operacao/ConsultarServicos";

export {
  listarCategoriasDeCusto,
  criarCategoriaDeCusto,
  atualizarCategoriaDeCusto,
  arquivarCategoriaDeCusto,
} from "./casos-de-uso/operacao/GerirCategoriasDeCusto";
export type {
  CategoriaDeCustoInput,
  CategoriaDeCustoDeps,
} from "./casos-de-uso/operacao/GerirCategoriasDeCusto";

export { resumirOperacao, resumirPorNegocio } from "./casos-de-uso/operacao/ResumirOperacao";
export type {
  ResumoDaOperacao,
  ResumirOperacaoDeps,
  LinhaDeResumo,
  CustoPorCategoria,
} from "./casos-de-uso/operacao/ResumirOperacao";

export { criarHabito, editarHabito, definirArquivamento, excluirHabito } from "./casos-de-uso/habitos/GerirHabitos";
export type { HabitoDeps } from "./casos-de-uso/habitos/GerirHabitos";

export { registrarDia, apagarRegistroDoDia, DiaNoFuturoError } from "./casos-de-uso/habitos/RegistrarDia";
export type { RegistroDeHabitoDeps } from "./casos-de-uso/habitos/RegistrarDia";

export {
  montarPainelDeHabitos,
  JANELA_DO_PAINEL_EM_DIAS,
  LIMITE_DE_QUEBRAS,
} from "./casos-de-uso/habitos/ConsultarHabitos";
export type { ConsultarHabitosDeps } from "./casos-de-uso/habitos/ConsultarHabitos";

export { HabitoNaoEncontradoError, HabitoDuplicadoError } from "./casos-de-uso/habitos/erros";

export type {
  HabitoDto,
  HabitoInput,
  PainelDeHabitosDto,
  QuebraDto,
  RelatoDoDiaDto,
  DiaDaSemanaDto,
  RegistroDoDiaInput,
} from "./casos-de-uso/habitos/dtos";
