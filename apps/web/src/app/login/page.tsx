import type { Metadata } from "next";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = {
  title: "Entrar · Sophia",
  // Uma tela de login não tem nada a ganhar aparecendo em buscador.
  robots: { index: false, follow: false },
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { proximo } = await searchParams;

  return (
    <main className="tela-login">
      <div className="tela-login__brilho" aria-hidden="true" />
      <section className="tela-login__conteudo">
        <header className="tela-login__cabecalho">
          <p className="selo">Sophia · WhatsApp</p>
          <h1>Entrar</h1>
          <p className="tela-login__subtitulo">Seus lembretes ficam deste lado da porta.</p>
        </header>
        <FormularioLogin destino={destinoSeguro(proximo)} />
      </section>
    </main>
  );
}

/**
 * `?proximo=` vem da URL, portanto de fora. Sem esta checagem,
 * `/login?proximo=https://outro.site` transformaria a tela de login num
 * redirecionador aberto — o degrau clássico de um phishing convincente.
 * Só caminho relativo passa, e `//host` é barrado porque o navegador o
 * lê como protocolo-relativo.
 */
function destinoSeguro(valor: string | string[] | undefined): string {
  if (typeof valor !== "string") return "/";
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/";
  return valor;
}
