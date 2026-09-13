/**
 * Guarda contra um segundo scheduler.
 *
 * `docker-stack.yml` fixa o worker em 1 réplica porque dois schedulers
 * na mesma tabela processam o mesmo lembrete vencido e o destinatário
 * recebe o WhatsApp duas vezes. Mas o limite do Swarm só governa o que
 * roda dentro do Swarm — não protege contra o caso que realmente
 * acontece: alguém rodando `pnpm dev:worker` na própria máquina com a
 * DATABASE_URL de produção.
 *
 * Regra: contra banco local, livre. Contra host remoto, exige
 * WORKER_PRIMARY=true — declarado só em `.env.production`, que nunca é
 * carregado em dev.
 *
 * Vive num módulo separado do `index.ts` porque lá o `main()` dispara
 * no import, e um teste não pode subir o worker para checar a regra.
 */

/** `postgres` e `advice_postgres` são nomes de serviço do Compose/Swarm. */
const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1", "postgres", "advice_postgres"]);

/** Host da connection string, ou undefined se ela não for parseável. */
export function hostDoBanco(databaseUrl: string): string | undefined {
  try {
    // WHATWG URL entrega IPv6 entre colchetes: [::1] -> ::1
    return new URL(databaseUrl).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return undefined;
  }
}

/**
 * URL ausente ou malformada devolve `true` de propósito: quem reclama
 * disso é a validação Zod em `getEnv()`, com mensagem melhor do que
 * qualquer coisa que esta guarda diria. Aqui só decidimos a questão do
 * scheduler duplicado.
 */
export function podeAgendarEnvios(
  databaseUrl: string | undefined,
  workerPrimary: string | undefined,
): boolean {
  if (!databaseUrl) return true;

  const host = hostDoBanco(databaseUrl);
  if (host === undefined) return true;

  return HOSTS_LOCAIS.has(host) || workerPrimary === "true";
}
