export { criarLembrete } from "./casos-de-uso/CriarLembrete";
export type {
  CriarLembreteInput,
  CriarLembreteDeps,
  CriarLembreteResultado,
} from "./casos-de-uso/CriarLembrete";

export { cancelarLembrete, LembreteNaoEncontradoError } from "./casos-de-uso/CancelarLembrete";
export type { CancelarLembreteDeps } from "./casos-de-uso/CancelarLembrete";

export { listarLembretes } from "./casos-de-uso/ListarLembretes";
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

export { resumirOperacao } from "./casos-de-uso/operacao/ResumirOperacao";
export type {
  ResumoDaOperacao,
  ResumirOperacaoDeps,
  LinhaDeResumo,
  CustoPorCategoria,
} from "./casos-de-uso/operacao/ResumirOperacao";
