import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { conferirSenha } from "./senha";

/**
 * A credencial do operador é configuração, não dado de aplicação: um
 * único e-mail, definido por env var, sem cadastro, sem recuperação,
 * sem tabela. Modelar um `Usuario` no banco para uma linha só adicionaria
 * migration, CRUD e superfície de ataque sem responder a nenhuma
 * necessidade real — ver "Autenticação" em ARCHITECTURE.md.
 *
 * Módulo exclusivo do runtime Node (usa `node:crypto` e scrypt). O
 * middleware, que roda no Edge, nunca importa daqui.
 */

const schema = z.object({
  AUTH_EMAIL: z.email(),
  AUTH_PASSWORD_HASH: z.string().startsWith("scrypt$", "AUTH_PASSWORD_HASH não está no formato scrypt$..."),
});

type AuthEnv = z.infer<typeof schema>;

let cache: AuthEnv | undefined;

/** Lazy pelo mesmo motivo de `getEnv()` em `@advice/infrastructure`. */
function getAuthEnv(): AuthEnv {
  if (!cache) {
    cache = schema.parse(process.env);
  }
  return cache;
}

/** O `sub` da sessão sai daqui, nunca do que o cliente digitou. */
export function emailDoOperador(): string {
  return normalizar(getAuthEnv().AUTH_EMAIL);
}

export async function credenciaisConferem(email: string, senha: string): Promise<boolean> {
  const env = getAuthEnv();

  const emailConfere = igualdadeEmTempoConstante(normalizar(email), normalizar(env.AUTH_EMAIL));

  // A senha é verificada SEMPRE, inclusive com e-mail errado. Curto-
  // circuitar aqui faria a resposta voltar em ~1ms para e-mail
  // desconhecido e em ~300ms para o e-mail certo — um oráculo de
  // enumeração medível de fora.
  const senhaConfere = await conferirSenha(senha, env.AUTH_PASSWORD_HASH);

  return emailConfere && senhaConfere;
}

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Passa pelo SHA-256 antes de comparar porque `timingSafeEqual` lança
 * quando os buffers têm tamanhos diferentes — e o tamanho do e-mail
 * digitado é justamente o que não pode vazar pela exceção.
 */
function igualdadeEmTempoConstante(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}
