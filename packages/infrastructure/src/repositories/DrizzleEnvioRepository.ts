import { count, eq } from "drizzle-orm";
import { Envio } from "@advice/domain";
import type { EnvioRepository, LembreteId } from "@advice/domain";
import { getDb } from "../db/client";
import { enviosTable } from "../db/schema";

export class DrizzleEnvioRepository implements EnvioRepository {
  async salvar(envio: Envio): Promise<void> {
    const props = envio.getProps();

    await getDb().insert(enviosTable).values({
      id: props.id.toString(),
      lembreteId: props.lembreteId.toString(),
      tentativa: props.tentativa,
      status: props.status,
      mensagemProviderId: props.mensagemProviderId,
      erro: props.erro,
      executadoEm: props.executadoEm,
    });
  }

  async contarTentativas(lembreteId: LembreteId): Promise<number> {
    const [linha] = await getDb()
      .select({ total: count() })
      .from(enviosTable)
      .where(eq(enviosTable.lembreteId, lembreteId.toString()));

    return linha?.total ?? 0;
  }
}
