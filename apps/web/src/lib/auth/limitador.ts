/**
 * Limitador de tentativas de login, em memória.
 *
 * Em memória é suficiente e correto aqui: `web` roda com 1 réplica fixa
 * (docker-stack.yml) e o processo é o único ponto de entrada. Redis só
 * passaria a fazer sentido com mais de uma réplica — e aí o limitador
 * deixa de ser a única coisa a mudar. Enquanto isso, uma dependência de
 * infraestrutura a mais para proteger um login de uso pessoal seria
 * custo sem retorno.
 *
 * O que ele realmente compra: cada tentativa custa ~300ms de CPU em
 * scrypt. Sem teto, um laço de requisições derruba o app por exaustão
 * de CPU muito antes de adivinhar a senha.
 */

export interface ResultadoLimite {
  permitido: boolean;
  /** Segundos até a janela reiniciar. Vira o `Retry-After`. */
  esperarSegundos: number;
}

export interface Limitador {
  consumir(chave: string): ResultadoLimite;
  /** Chamado depois de um login bem-sucedido, para não punir o dono. */
  liberar(chave: string): void;
}

interface Janela {
  tentativas: number;
  reiniciaEm: number;
}

export interface OpcoesLimitador {
  limite: number;
  janelaMs: number;
  /**
   * Teto de chaves distintas. `X-Forwarded-For` é atribuído pelo
   * Traefik, mas um Map sem teto ainda é uma bomba de memória se algo
   * mudar na frente; ao estourar, o mapa é podado e, se ainda assim
   * estiver cheio, a janela mais antiga cede o lugar.
   */
  maxChaves?: number;
  /** Injetável para o teste não depender do relógio real. */
  agora?: () => number;
}

export function criarLimitador({
  limite,
  janelaMs,
  maxChaves = 1024,
  agora = Date.now,
}: OpcoesLimitador): Limitador {
  const janelas = new Map<string, Janela>();

  function podar(momento: number): void {
    for (const [chave, janela] of janelas) {
      if (janela.reiniciaEm <= momento) janelas.delete(chave);
    }
  }

  return {
    consumir(chave: string): ResultadoLimite {
      const momento = agora();
      const janela = janelas.get(chave);

      if (!janela || janela.reiniciaEm <= momento) {
        if (janelas.size >= maxChaves) {
          podar(momento);
          if (janelas.size >= maxChaves) {
            const maisAntiga = janelas.keys().next();
            if (!maisAntiga.done) janelas.delete(maisAntiga.value);
          }
        }
        janelas.set(chave, { tentativas: 1, reiniciaEm: momento + janelaMs });
        return { permitido: true, esperarSegundos: 0 };
      }

      janela.tentativas += 1;

      if (janela.tentativas > limite) {
        return { permitido: false, esperarSegundos: Math.ceil((janela.reiniciaEm - momento) / 1000) };
      }

      return { permitido: true, esperarSegundos: 0 };
    },

    liberar(chave: string): void {
      janelas.delete(chave);
    },
  };
}

const JANELA_MS = 15 * 60 * 1000;

/** 5 tentativas por IP a cada 15 min. */
export const limitadorPorIp = criarLimitador({ limite: 5, janelaMs: JANELA_MS });

/**
 * Teto global, independente de IP: `X-Forwarded-For` é trivial de girar
 * e o limite por IP sozinho não impede que a CPU seja consumida.
 */
export const limitadorGlobal = criarLimitador({ limite: 30, janelaMs: JANELA_MS, maxChaves: 1 });

/**
 * Atrás do Traefik, `request.ip` não existe e o socket é sempre o do
 * proxy. O primeiro item de `X-Forwarded-For` é o cliente real —
 * confiável exatamente na medida em que o Traefik é o único caminho até
 * o container (rede `Monadanet`, porta 3000 não publicada).
 */
export function ipDaRequisicao(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  const primeiro = encaminhado?.split(",")[0]?.trim();
  return primeiro && primeiro.length > 0 ? primeiro : (request.headers.get("x-real-ip") ?? "desconhecido");
}
