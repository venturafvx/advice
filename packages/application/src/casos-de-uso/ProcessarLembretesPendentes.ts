import { Envio } from "@advice/domain";
import type { EnvioRepository, LembreteRepository, NotificadorWhatsApp } from "@advice/domain";

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
}

/**
 * Executado periodicamente pelo scheduler (worker). Busca lembretes
 * pendentes cujo horário já venceu, tenta enviar via WhatsApp e aplica
 * a política de retry: até MAX_TENTATIVAS falhas antes de marcar o
 * lembrete como definitivamente FALHOU. Enquanto não esgotar as
 * tentativas, o lembrete continua PENDENTE e será retentado no próximo ciclo.
 */
export async function processarLembretesPendentes(
  deps: ProcessarLembretesDeps,
  agora: Date = new Date(),
): Promise<ProcessarLembretesResultado> {
  const pendentes = await deps.lembreteRepository.buscarPendentesVencidos(agora);

  let enviados = 0;
  let falharamDefinitivamente = 0;
  let tentativasComFalha = 0;

  for (const lembrete of pendentes) {
    const tentativasAnteriores = await deps.envioRepository.contarTentativas(lembrete.getId());
    const tentativaAtual = tentativasAnteriores + 1;

    const resultado = await deps.notificador.enviar({ texto: lembrete.getTitulo() });

    if (resultado.sucesso) {
      const envio = Envio.registrarSucesso(lembrete.getId(), tentativaAtual, resultado.mensagemProviderId ?? null, agora);
      await deps.envioRepository.salvar(envio);
      lembrete.marcarComoEnviado(agora);
      enviados++;
    } else {
      const envio = Envio.registrarFalha(lembrete.getId(), tentativaAtual, resultado.erro ?? "erro desconhecido", agora);
      await deps.envioRepository.salvar(envio);
      tentativasComFalha++;

      if (tentativaAtual >= MAX_TENTATIVAS) {
        lembrete.marcarComoFalhou(resultado.erro ?? "número máximo de tentativas excedido", agora);
        falharamDefinitivamente++;
      }
    }

    await deps.lembreteRepository.salvar(lembrete);
  }

  return { processados: pendentes.length, enviados, falharamDefinitivamente, tentativasComFalha };
}
