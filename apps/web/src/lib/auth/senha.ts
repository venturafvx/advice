import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha com scrypt do `node:crypto`.
 *
 * Por que scrypt e não Argon2id: Argon2id é marginalmente preferível no
 * papel, mas todas as implementações em Node são módulos nativos
 * (node-gyp ou napi-rs) — dependência binária a mais no supply chain e
 * um risco real de build quebrado na imagem Alpine. scrypt é memory-hard,
 * está no core do Node desde a v10, é recomendação explícita da OWASP
 * Password Storage Cheat Sheet e custa zero dependência. Para um login
 * de um único operador, essa troca é obviamente vantajosa.
 */

/** Parâmetros OWASP para scrypt: N=2^17, r=8, p=1. */
const N_PADRAO = 131072;
const R_PADRAO = 8;
const P_PADRAO = 1;
const TAMANHO_CHAVE = 32;
const TAMANHO_SAL = 16;

/**
 * N=2^17 com r=8 pede 128 * N * r = 128 MiB. O teto default do Node é
 * 32 MiB, então precisa ser explicitado; a folga até 256 MiB existe
 * porque o Node contabiliza alocações internas no mesmo limite.
 */
const MAXMEM = 256 * 1024 * 1024;

/** Teto de sanidade ao ler parâmetros de um hash já existente. */
const N_MAXIMO = 1 << 20;

interface Parametros {
  n: number;
  r: number;
  p: number;
}

/** Formato: `scrypt$N$r$p$sal-base64$chave-base64`. */
export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const parametros: Parametros = { n: N_PADRAO, r: R_PADRAO, p: P_PADRAO };
  const chave = await derivar(senha, sal, parametros, TAMANHO_CHAVE);

  return [
    "scrypt",
    parametros.n,
    parametros.r,
    parametros.p,
    sal.toString("base64"),
    chave.toString("base64"),
  ].join("$");
}

/**
 * Os parâmetros vêm do próprio hash, não das constantes acima: subir o
 * custo no futuro não invalida a senha já configurada.
 */
export async function conferirSenha(senha: string, hashArmazenado: string): Promise<boolean> {
  const analisado = analisarHash(hashArmazenado);
  if (!analisado) return false;

  const { parametros, sal, chaveEsperada } = analisado;
  const chave = await derivar(senha, sal, parametros, chaveEsperada.length);

  return chave.length === chaveEsperada.length && timingSafeEqual(chave, chaveEsperada);
}

function derivar(senha: string, sal: Buffer, parametros: Parametros, tamanho: number): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    // NFKC: "café" digitado em macOS e em Linux são sequências de bytes
    // diferentes para o mesmo texto. Sem normalizar, a mesma senha
    // falharia dependendo do teclado.
    scrypt(
      senha.normalize("NFKC"),
      sal,
      tamanho,
      { N: parametros.n, r: parametros.r, p: parametros.p, maxmem: MAXMEM },
      (erro, chave) => (erro ? rejeitar(erro) : resolver(chave)),
    );
  });
}

function analisarHash(hash: string): { parametros: Parametros; sal: Buffer; chaveEsperada: Buffer } | null {
  const partes = hash.split("$");
  if (partes.length !== 6) return null;

  const [algoritmo, nBruto, rBruto, pBruto, salBruto, chaveBruta] = partes;
  if (algoritmo !== "scrypt") return null;

  const n = Number(nBruto);
  const r = Number(rBruto);
  const p = Number(pBruto);

  // Um N absurdo vindo de um hash malformado travaria o processo por
  // minutos; barrar aqui custa nada.
  if (!ehPotenciaDeDois(n) || n > N_MAXIMO) return null;
  if (!Number.isInteger(r) || r < 1 || r > 32) return null;
  if (!Number.isInteger(p) || p < 1 || p > 16) return null;

  const sal = Buffer.from(salBruto ?? "", "base64");
  const chaveEsperada = Buffer.from(chaveBruta ?? "", "base64");
  if (sal.length === 0 || chaveEsperada.length < 16) return null;

  return { parametros: { n, r, p }, sal, chaveEsperada };
}

function ehPotenciaDeDois(valor: number): boolean {
  return Number.isInteger(valor) && valor > 1 && (valor & (valor - 1)) === 0;
}
