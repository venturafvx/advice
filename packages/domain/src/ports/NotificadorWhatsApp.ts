export interface MensagemParaEnvio {
  texto: string;
}

export interface ResultadoEnvioWhatsApp {
  sucesso: boolean;
  mensagemProviderId?: string;
  erro?: string;
}

/**
 * Porta de saída do domínio para envio de mensagens.
 * Nenhum detalhe da Evolution API (URL, instância, apikey, payload HTTP)
 * pode vazar para fora da implementação concreta desta interface.
 */
export interface NotificadorWhatsApp {
  enviar(mensagem: MensagemParaEnvio): Promise<ResultadoEnvioWhatsApp>;
}
