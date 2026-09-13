import { EnvioId } from "./EnvioId";
import { StatusEnvio } from "./StatusEnvio";
import type { LembreteId } from "../lembrete/LembreteId";

export interface EnvioProps {
  id: EnvioId;
  lembreteId: LembreteId;
  tentativa: number;
  status: StatusEnvio;
  mensagemProviderId: string | null;
  erro: string | null;
  executadoEm: Date;
}

/**
 * Registra cada tentativa de entrega de um Lembrete via WhatsApp.
 * Fica em aggregate próprio (não dentro de Lembrete) porque o histórico
 * de tentativas cresce de forma ilimitada e não faz parte do invariante
 * do Lembrete em si — só o resultado final (status) importa para ele.
 */
export class Envio {
  private constructor(private readonly props: EnvioProps) {}

  static registrarSucesso(
    lembreteId: LembreteId,
    tentativa: number,
    mensagemProviderId: string | null,
    agora: Date = new Date(),
  ): Envio {
    return new Envio({
      id: EnvioId.novo(),
      lembreteId,
      tentativa,
      status: StatusEnvio.SUCESSO,
      mensagemProviderId,
      erro: null,
      executadoEm: agora,
    });
  }

  static registrarFalha(lembreteId: LembreteId, tentativa: number, erro: string, agora: Date = new Date()): Envio {
    return new Envio({
      id: EnvioId.novo(),
      lembreteId,
      tentativa,
      status: StatusEnvio.FALHA,
      mensagemProviderId: null,
      erro,
      executadoEm: agora,
    });
  }

  static restaurar(props: EnvioProps): Envio {
    return new Envio(props);
  }

  foiSucesso(): boolean {
    return this.props.status === StatusEnvio.SUCESSO;
  }

  getProps(): Readonly<EnvioProps> {
    return this.props;
  }
}
