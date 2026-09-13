/**
 * Define a credencial de acesso do app.
 *
 *   pnpm auth:senha                 # escreve nos .env que existirem
 *   pnpm auth:senha --arquivo .env  # só num arquivo específico
 *
 * A senha é digitada aqui, no terminal de quem é dono dela: não passa
 * por argumento de linha de comando (ficaria no histórico do shell e em
 * `ps`), não é impressa, não é logada. O que sai daqui é o hash scrypt.
 *
 * AUTH_SESSION_SECRET é gerado por arquivo, nunca compartilhado entre
 * dev e produção: um segredo vazado do laptop não deve assinar sessão
 * válida em advice.autozapx.com.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gerarHashDeSenha } from "../apps/web/src/lib/auth/senha";

const RAIZ = resolve(import.meta.dirname, "..");
const ARQUIVOS_PADRAO = [".env", ".env.production"];
const TAMANHO_MINIMO_SENHA = 12;

const ENTER = "\r";
const NOVA_LINHA = "\n";
const FIM_DE_ARQUIVO = String.fromCharCode(4);
const CANCELAR = String.fromCharCode(3);
const BACKSPACE = String.fromCharCode(127);
const BACKSPACE_ALT = String.fromCharCode(8);

async function main(): Promise<void> {
  const alvos = arquivosAlvo();

  if (alvos.length === 0) {
    encerrar("Nenhum arquivo de env encontrado. Rode `cp .env.example .env` antes.");
  }

  console.log("\n  Definindo a credencial de acesso do advice.");
  console.log(`  Arquivos: ${alvos.join(", ")}\n`);

  const email = await resolverEmail(alvos);
  const senha = await pedirSenha();

  console.log("\n  Derivando o hash (scrypt, ~1s)...");
  const hash = await gerarHashDeSenha(senha);

  for (const arquivo of alvos) {
    const caminho = resolve(RAIZ, arquivo);
    const atualizado = aplicar(readFileSync(caminho, "utf8"), {
      AUTH_EMAIL: email,
      // Aspas simples obrigatórias: o hash contém `$` e o
      // scripts/deploy-vps.sh dá `source .env`. Sem aspas, o bash
      // expandiria `$1`, `$8` como parâmetros posicionais e o hash
      // chegaria mutilado em produção — falha silenciosa, login morto.
      AUTH_PASSWORD_HASH: citar(hash),
      // Regenerado a cada execução de propósito: trocar a senha deve
      // derrubar as sessões abertas com a senha antiga.
      AUTH_SESSION_SECRET: citar(randomBytes(32).toString("base64")),
    });
    writeFileSync(caminho, atualizado, { mode: 0o600 });
    console.log(`  ok  ${arquivo}`);
  }

  console.log(`\n  Pronto. E-mail de acesso: ${email}`);
  if (alvos.includes(".env.production")) {
    console.log("  Produção só muda depois de:  ./scripts/enviar-env-producao.sh <user>@<host>");
    console.log("                               (e, no VPS) ./scripts/deploy-vps.sh");
  }
  console.log("");
}

function arquivosAlvo(): string[] {
  const indice = process.argv.indexOf("--arquivo");
  const candidatos = indice >= 0 ? [process.argv[indice + 1] ?? ""] : ARQUIVOS_PADRAO;

  return candidatos.filter((arquivo) => arquivo !== "" && existe(resolve(RAIZ, arquivo)));
}

function existe(caminho: string): boolean {
  try {
    readFileSync(caminho, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function resolverEmail(alvos: string[]): Promise<string> {
  const atual = alvos
    .map((arquivo) => valorDe(readFileSync(resolve(RAIZ, arquivo), "utf8"), "AUTH_EMAIL"))
    .find((valor) => valor !== undefined);

  const resposta = (await perguntar(`  E-mail de acesso${atual ? ` [${atual}]` : ""}: `)).trim();
  const email = resposta || atual || "";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    encerrar("E-mail inválido.");
  }
  return email.toLowerCase();
}

async function pedirSenha(): Promise<string> {
  const senha = await perguntarOculto("  Senha: ");

  if (senha.length < TAMANHO_MINIMO_SENHA) {
    encerrar(`Senha curta demais — mínimo de ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }

  const confirmacao = await perguntarOculto("  Repita a senha: ");
  if (senha !== confirmacao) {
    encerrar("As senhas não conferem.");
  }

  return senha;
}

/**
 * Substitui a linha da chave se ela já existir (preservando comentários
 * e ordem do arquivo) e, se não existir, acrescenta um bloco no fim.
 * Reescrever o arquivo inteiro apagaria a documentação que mora nele.
 */
function aplicar(conteudo: string, valores: Record<string, string>): string {
  let saida = conteudo;
  const faltando: [string, string][] = [];

  for (const [chave, valor] of Object.entries(valores)) {
    const padrao = new RegExp(`^${chave}=.*$`, "m");
    if (padrao.test(saida)) {
      // Função, não string: `$` no hash seria lido como referência de
      // grupo de captura (`$1`, `$&`) numa substituição literal.
      saida = saida.replace(padrao, () => `${chave}=${valor}`);
    } else {
      faltando.push([chave, valor]);
    }
  }

  if (faltando.length > 0) {
    const bloco = faltando.map(([chave, valor]) => `${chave}=${valor}`).join("\n");
    saida = `${saida.replace(/\s*$/, "")}\n\n# Acesso (gerado por \`pnpm auth:senha\`)\n${bloco}\n`;
  }

  return saida;
}

/** base64 e o hash scrypt nunca contêm aspa simples, então isto basta. */
function citar(valor: string): string {
  return `'${valor}'`;
}

function valorDe(conteudo: string, chave: string): string | undefined {
  const encontrado = new RegExp(`^${chave}=(.*)$`, "m").exec(conteudo);
  const bruto = encontrado?.[1]?.trim();
  return bruto ? bruto.replace(/^['"]|['"]$/g, "") : undefined;
}

function perguntar(rotulo: string): Promise<string> {
  process.stdout.write(rotulo);
  return new Promise((resolver) => {
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (bloco: string) => {
      process.stdin.pause();
      resolver(bloco.replace(/\r?\n$/, ""));
    });
  });
}

/**
 * Lê sem eco na tela. Usa só API pública (`setRawMode`), não o
 * `_writeToOutput` privado do readline que a maioria dos exemplos usa.
 */
function perguntarOculto(rotulo: string): Promise<string> {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    encerrar("Este comando precisa de um terminal interativo (não use com pipe).");
  }

  stdout.write(rotulo);

  return new Promise((resolver, rejeitar) => {
    let valor = "";

    function finalizar(): void {
      stdin.removeListener("data", aoReceber);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    }

    function aoReceber(bloco: string): void {
      for (const caractere of bloco) {
        if (caractere === ENTER || caractere === NOVA_LINHA || caractere === FIM_DE_ARQUIVO) {
          finalizar();
          resolver(valor);
          return;
        }
        if (caractere === CANCELAR) {
          finalizar();
          rejeitar(new Error("cancelado"));
          return;
        }
        if (caractere === BACKSPACE || caractere === BACKSPACE_ALT) {
          valor = valor.slice(0, -1);
          continue;
        }
        if (caractere >= " ") valor += caractere;
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", aoReceber);
  });
}

function encerrar(mensagem: string): never {
  console.error(`\n  ERRO: ${mensagem}\n`);
  process.exit(1);
}

main().then(
  () => process.exit(0),
  (erro: unknown) => {
    console.error(`\n  ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exit(1);
  },
);
