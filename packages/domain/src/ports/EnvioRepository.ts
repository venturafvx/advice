import type { Envio } from "../envio/Envio";
import type { LembreteId } from "../lembrete/LembreteId";

export interface EnvioRepository {
  salvar(envio: Envio): Promise<void>;
  contarTentativas(lembreteId: LembreteId): Promise<number>;
}
