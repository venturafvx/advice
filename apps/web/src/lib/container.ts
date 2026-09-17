import {
  DrizzleCategoriaDeCustoRepository,
  DrizzleCompraRepository,
  DrizzleEnvioRepository,
  DrizzleHabitoRepository,
  DrizzleLembreteRepository,
  DrizzleRegistroDeHabitoRepository,
  DrizzleServicoRepository,
  EvolutionApiNotificador,
} from "@advice/infrastructure";

/**
 * Composition root: único lugar onde a Web app conhece as implementações
 * concretas de infraestrutura. As API routes dependem só das interfaces
 * do domínio, injetadas a partir daqui.
 */
export const lembreteRepository = new DrizzleLembreteRepository();
export const envioRepository = new DrizzleEnvioRepository();
export const notificador = new EvolutionApiNotificador();

export const compraRepository = new DrizzleCompraRepository();
export const servicoRepository = new DrizzleServicoRepository();
export const categoriaRepository = new DrizzleCategoriaDeCustoRepository();

export const habitoRepository = new DrizzleHabitoRepository();
export const registroRepository = new DrizzleRegistroDeHabitoRepository();
