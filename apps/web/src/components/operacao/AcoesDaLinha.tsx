"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconeLixeira } from "@/components/lembretes-ui";

/**
 * Editar e apagar direto da lista.
 *
 * Antes, a única forma de mexer num lançamento era descobrir que a
 * linha inteira era clicável — uma afordância invisível. Agora as duas
 * ações têm nome e ficam na linha.
 *
 * Apagar é em dois toques e sem `window.confirm` (mesma razão da lista
 * de lembretes: o diálogo do navegador some do fluxo e treina o dedo a
 * clicar "OK" sem ler). A confirmação acontece no lugar do botão,
 * dentro da linha que vai desaparecer.
 */
export function AcoesDaLinha({
  href,
  recurso,
  id,
  rotulo,
}: {
  /** Para onde o "Editar" leva. */
  href: string;
  /** Segmento da API: `compras` ou `servicos`. */
  recurso: "compras" | "servicos";
  id: string;
  /** O que está sendo apagado, para o leitor de tela. */
  rotulo: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState(false);

  async function apagar(): Promise<void> {
    setApagando(true);
    setErro(false);
    try {
      const resposta = await fetch(`/api/operacao/${recurso}/${id}`, { method: "DELETE" });
      if (!resposta.ok) {
        setErro(true);
        setApagando(false);
        return;
      }
      setConfirmando(false);
      router.refresh();
    } catch {
      setErro(true);
      setApagando(false);
    }
  }

  if (confirmando) {
    return (
      <div className="confirmacao">
        <span>{erro ? "Não deu — tentar de novo?" : "Apagar de vez?"}</span>
        <button
          type="button"
          className="botao botao-perigo compacto"
          onClick={() => void apagar()}
          disabled={apagando}
        >
          {apagando ? "Apagando…" : "Apagar"}
        </button>
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => {
            setConfirmando(false);
            setErro(false);
          }}
          disabled={apagando}
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <div className="acoes-linha">
      <Link href={href} className="botao botao-secundario compacto">
        Editar
      </Link>
      <button
        type="button"
        className="botao-icone"
        title={`Apagar ${rotulo}`}
        aria-label={`Apagar ${rotulo}`}
        onClick={() => setConfirmando(true)}
      >
        <IconeLixeira />
      </button>
    </div>
  );
}
