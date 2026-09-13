import type { MensagemParaEnvio, NotificadorWhatsApp, ResultadoEnvioWhatsApp } from "@advice/domain";
import { getEnv } from "../config/env";

interface EvolutionSendTextResponse {
  key?: { id?: string };
}

/**
 * Anti-corruption layer contra a Evolution API.
 *
 * Nenhum outro ponto do sistema conhece a URL, o nome da instância, a
 * apikey ou o formato do payload HTTP — tudo isso fica isolado aqui.
 * Se a Evolution API mudar de versão (ou for trocada por outro provedor
 * de WhatsApp), só este arquivo precisa mudar.
 */
export class EvolutionApiNotificador implements NotificadorWhatsApp {
  async enviar(mensagem: MensagemParaEnvio): Promise<ResultadoEnvioWhatsApp> {
    const env = getEnv();
    const url = `${env.EVOLUTION_API_BASE_URL}/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`;

    try {
      const resposta = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: env.WHATSAPP_DESTINO,
          text: mensagem.texto,
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.text();
        return { sucesso: false, erro: `Evolution API retornou ${resposta.status}: ${corpo}` };
      }

      const dados = (await resposta.json()) as EvolutionSendTextResponse;
      const mensagemProviderId = dados.key?.id;
      return mensagemProviderId ? { sucesso: true, mensagemProviderId } : { sucesso: true };
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : "erro desconhecido ao chamar a Evolution API";
      return { sucesso: false, erro: detalhe };
    }
  }
}
