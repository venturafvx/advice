import { Envio } from "@advice/domain";
import type { EnvioRepository, Lembrete, LembreteRepository, NotificadorWhatsApp } from "@advice/domain";

const MAX_TENTATIVAS = 3;

export interface ProcessarLembretesDeps {
  lembreteRepository: LembreteRepository;
  envioRepository: EnvioRepository;
  notificador: NotificadorWhatsApp;
}

export interface ProcessarLembretesResultado {
  processados: number;
  enviados: number;
  falharamDefinitivamente: number;
  tentativasComFalha: number;
  /** Ocorrências futuras criadas por lembretes recorrentes que terminaram neste ciclo. */
  proximasAgendadas: number;
}

/**
 * Executado periodicamente pelo scheduler (worker). Busca lembretes
 * pendentes cujo horário já venceu, tenta enviar via WhatsApp e aplica
 * a política de retry: até MAX_TENTATIVAS falhas antes de marcar o
 * lembrete como definitivamente FALHOU. Enquanto não esgotar as
 * tentativas, o lembrete continua PENDENTE e será retentado no próximo ciclo.
 *
 * Quando o lembrete é recorrente e chega a um estado terminal, a próxima
 * ocorrência da série é materializada aqui.
 */
export async function processarLembretesPendentes(
  deps: ProcessarLembretesDeps,
  agora: Date = new Date(),
): Promise<ProcessarLembretesResultado> {
  const pendentes = await deps.lembreteRepository.buscarPendentesVencidos(agora);

  let enviados = 0;
  let falharamDefinitivamente = 0;
  let tentativasComFalha = 0;
  let proximasAgendadas = 0;

  for (const lembrete of pendentes) {
    const tentativasAnteriores = await deps.envioRepository.contarTentativas(lembrete.getId());
    const tentativaAtual = tentativasAnteriores + 1;

    const resultado = await deps.notificador.enviar({ texto: lembrete.getTitulo() });

    if (resultado.sucesso) {
      const envio = Envio.registrarSucesso(
        lembrete.getId(),
        tentativaAtual,
        resultado.mensagemProviderId ?? null,
        agora,
      );
      await deps.envioRepository.salvar(envio);
      lembrete.marcarComoEnviado(agora);
      enviados++;
    } else {
      const envio = Envio.registrarFalha(
        lembrete.getId(),
        tentativaAtual,
        resultado.erro ?? "erro desconhecido",
        agora,
      );
      await deps.envioRepository.salvar(envio);
      tentativasComFalha++;

      if (tentativaAtual >= MAX_TENTATIVAS) {
        lembrete.marcarComoFalhou(resultado.erro ?? "número máximo de tentativas excedido", agora);
        falharamDefinitivamente++;
      }
    }

    if (await materializarProximaOcorrencia(lembrete, deps, agora)) {
      proximasAgendadas++;
    }

    // `atualizar` e não `salvar`: se o lembrete tiver sido apagado
    // enquanto este ciclo rodava, ele fica apagado — um upsert o traria
    // de volta já marcado como ENVIADO. Ver a porta.
    await deps.lembreteRepository.atualizar(lembrete);
  }

  return {
    processados: pendentes.length,
    enviados,
    falharamDefinitivamente,
    tentativasComFalha,
    proximasAgendadas,
  };
}

/**
 * A próxima ocorrência é gravada **antes** do estado terminal da atual.
 * A ordem não é acidental: não há transação cobrindo as duas escritas
 * (o repositório é por aggregate, de propósito), então uma delas vai
 * primeiro e é preciso escolher qual falha melhor.
 *
 * - Terminal primeiro: uma queda no meio deixa a série sem sucessor —
 *   o lembrete diário simplesmente nunca mais chega, em silêncio.
 * - Sucessor primeiro: uma queda no meio faz o ciclo seguinte reenviar
 *   a ocorrência atual (uma mensagem repetida, visível) e recriar o
 *   mesmo sucessor — que tem id determinístico, logo o `upsert` grava
 *   por cima de si mesmo em vez de duplicar.
 *
 * Mensagem repetida se conserta; série morta em silêncio, não.
 */
async function materializarProximaOcorrencia(
  lembrete: Lembrete,
  deps: ProcessarLembretesDeps,
  agora: Date,
): Promise<boolean> {
  const proxima = lembrete.gerarProximaOcorrencia(agora);
  if (!proxima) return false;

  await deps.lembreteRepository.salvar(proxima);
  return true;
}
