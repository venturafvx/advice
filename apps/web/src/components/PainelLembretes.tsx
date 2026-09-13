"use client";

import { useState, type FormEvent } from "react";
import type { LembreteResumo } from "@advice/application";
import { StatusLembrete } from "@advice/domain";

interface LembreteResumoSerializado extends Omit<LembreteResumo, "agendadoPara"> {
  agendadoPara: string;
}

const RESPONSAVEL_STATUS: Record<string, { rotulo: string; cor: string }> = {
  [StatusLembrete.PENDENTE]: { rotulo: "Pendente", cor: "var(--status-pendente)" },
  [StatusLembrete.ENVIADO]: { rotulo: "Enviado", cor: "var(--status-enviado)" },
  [StatusLembrete.FALHOU]: { rotulo: "Falhou", cor: "var(--status-falhou)" },
  [StatusLembrete.CANCELADO]: { rotulo: "Cancelado", cor: "var(--status-cancelado)" },
};

function formatarQuando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PainelLembretes({ lembretesIniciais }: { lembretesIniciais: LembreteResumoSerializado[] }) {
  const [lembretes, setLembretes] = useState(lembretesIniciais);
  const [titulo, setTitulo] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function recarregar(): Promise<void> {
    const resposta = await fetch("/api/lembretes", { cache: "no-store" });
    const dados = (await resposta.json()) as { lembretes: LembreteResumoSerializado[] };
    setLembretes(dados.lembretes);
  }

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);

    if (!dia || !hora) {
      setErro("Escolha o dia e a hora do lembrete");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/lembretes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, agendadoPara: `${dia}T${hora}` }),
      });

      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível criar o lembrete");
        return;
      }

      setTitulo("");
      setDia("");
      setHora("");
      await recarregar();
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id: string): Promise<void> {
    setLembretes((atual) => atual.map((l) => (l.id === id ? { ...l, status: StatusLembrete.CANCELADO } : l)));
    const resposta = await fetch(`/api/lembretes/${id}`, { method: "DELETE" });
    if (!resposta.ok) {
      await recarregar();
    }
  }

  const pendentes = lembretes.filter((l) => l.status === StatusLembrete.PENDENTE);
  const historico = lembretes.filter((l) => l.status !== StatusLembrete.PENDENTE);

  return (
    <>
      <form className="cartao" onSubmit={aoSubmeter}>
        <div className="campo">
          <label htmlFor="titulo">O que você quer lembrar?</label>
          <input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Pagar o fornecedor X"
            maxLength={200}
            required
          />
        </div>
        <div className="linha">
          <div className="campo">
            <label htmlFor="dia">Dia</label>
            <input id="dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="hora">Hora</label>
            <input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
          </div>
        </div>
        {erro ? <p className="erro">{erro}</p> : null}
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? "Agendando…" : "Agendar lembrete"}
        </button>
      </form>

      <p className="secao-titulo">Pendentes</p>
      <div className="cartao">
        {pendentes.length === 0 ? (
          <p className="lista-vazia">Nenhum lembrete pendente.</p>
        ) : (
          pendentes.map((lembrete) => (
            <div className="item-lembrete" key={lembrete.id}>
              <div className="conteudo">
                <p className="titulo">{lembrete.titulo}</p>
                <p className="quando">{formatarQuando(lembrete.agendadoPara)}</p>
              </div>
              <div className="acoes">
                <button type="button" className="botao botao-secundario" onClick={() => cancelar(lembrete.id)}>
                  Cancelar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {historico.length > 0 ? (
        <>
          <p className="secao-titulo">Histórico</p>
          <div className="cartao">
            {historico.map((lembrete) => {
              const info = RESPONSAVEL_STATUS[lembrete.status] ?? { rotulo: lembrete.status, cor: "var(--text-tertiary)" };
              return (
                <div className="item-lembrete" key={lembrete.id}>
                  <div className="conteudo">
                    <p className="titulo">{lembrete.titulo}</p>
                    <p className="quando">{formatarQuando(lembrete.agendadoPara)}</p>
                  </div>
                  <div className="acoes">
                    <span className="selo-status" style={{ ["--cor-status" as string]: info.cor }}>
                      {info.rotulo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
