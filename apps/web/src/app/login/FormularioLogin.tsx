"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function FormularioLogin({ destino }: { destino: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setEntrando(true);

    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;
        setErro(dados?.erro ?? "Não foi possível entrar");
        setSenha("");
        return;
      }

      // `replace` (não `push`) para que o botão "voltar" não devolva a
      // tela de login depois de autenticado.
      router.replace(destino);
      // O layout logado é renderizado no servidor: sem refresh, o
      // cliente reaproveitaria a árvore em cache de antes da sessão.
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <form className="cartao cartao-login" onSubmit={aoSubmeter} noValidate>
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          spellCheck={false}
          required
        />
      </div>

      <div className="campo">
        <div className="campo__rotulo-linha">
          <label htmlFor="senha">Senha</label>
          <button type="button" className="link-discreto" onClick={() => setMostrarSenha((v) => !v)}>
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <input
          id="senha"
          name="senha"
          type={mostrarSenha ? "text" : "password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {erro ? (
        <p className="erro" role="alert">
          {erro}
        </p>
      ) : null}

      <button type="submit" className="botao botao-primario" disabled={entrando}>
        {entrando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
