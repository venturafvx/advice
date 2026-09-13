import { DrizzleEnvioRepository, DrizzleLembreteRepository, EvolutionApiNotificador } from "@advice/infrastructure";

/**
 * Composition root: único lugar onde a Web app conhece as implementações
 * concretas de infraestrutura. As API routes dependem só das interfaces
 * do domínio, injetadas a partir daqui.
 */
export const lembreteRepository = new DrizzleLembreteRepository();
export const envioRepository = new DrizzleEnvioRepository();
export const notificador = new EvolutionApiNotificador();
