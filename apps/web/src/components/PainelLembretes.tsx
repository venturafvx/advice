"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LembreteResumo } from "@advice/application";
import { StatusLembrete } from "@advice/domain";
import { descreverRecorrencia, formatarHoraMinuto } from "@/lib/recorrencia";
import { FormularioLembrete, valoresDe, type CorpoDeLembrete } from "@/components/FormularioLembrete";
import {
  IconeLixeira,
  IconeLupa,
  IconeRepetir,
  SeloRepeticao,
  formatarQuando,
} from "@/components/lembretes-ui";

interface LembreteSerializado extends Omit<LembreteResumo, "agendadoPara"> {
  agendadoPara: string;
}

const RESPONSAVEL_STATUS: Record<string, { rotulo: string; cor: string }> = {
  [StatusLembrete.PENDENTE]: { rotulo: "Pendente", cor: "var(--status-pendente)" },
  [StatusLembrete.ENVIADO]: { rotulo: "Enviado", cor: "var(--status-enviado)" },
  [StatusLembrete.FALHOU]: { rotulo: "Falhou", cor: "var(--status-falhou)" },
  [StatusLembrete.CANCELADO]: { rotulo: "Cancelado", cor: "var(--status-cancelado)" },
};

/** Tempo entre a última tecla e a consulta. Curto o bastante para parecer instantâneo. */
const ESPERA_DA_BUSCA_MS = 250;

/**
 * Apagar em dois toques, e sem `window.confirm`: o diálogo do navegador
 * é feio, some do fluxo e treina o dedo a clicar "OK" sem ler. A
 * confirmação acontece no lugar do botão, dentro da própria linha que
 * vai desaparecer.
 */
function BotaoApagar({
  rotulo,
  confirmando,
  aoPedirConfirmacao,
  aoConfirmar,
  aoDesistir,
}: {
  rotulo: string;
  confirmando: boolean;
  aoPedirConfirmacao: () => void;
  aoConfirmar: () => void;
  aoDesistir: () => void;
}) {
  if (confirmando) {
    return (
      <div className="confirmacao">
        <span>Apagar de vez?</span>
        <button type="button" className="botao botao-perigo compacto" onClick={aoConfirmar}>
          Apagar
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoDesistir}>
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="botao-icone"
      title={rotulo}
      aria-label={rotulo}
      onClick={aoPedirConfirmacao}
    >
      <IconeLixeira />
    </button>
  );
}

export function PainelLembretes({
  pendentesIniciais,
  historicoInicial,
}: {
  pendentesIniciais: LembreteSerializado[];
  historicoInicial: LembreteSerializado[];
}) {
  const router = useRouter();
  const [pendentes, setPendentes] = useState(pendentesIniciais);
  const [historico, setHistorico] = useState(historicoInicial);

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const primeiraRenderizacao = useRef(true);

  /**
   * A sessão pode vencer com a aba aberta. Sem isto, a próxima ação
   * falharia em silêncio (ou tentaria ler HTML como JSON) em vez de
   * levar de volta para o login.
   */
  const sessaoAcabou = useCallback(
    (resposta: Response): boolean => {
      if (resposta.status !== 401) return false;
      router.replace("/login");
      router.refresh();
      return true;
    },
    [router],
  );

  const recarregar = useCallback(
    async (termo: string): Promise<void> => {
      const url = termo.trim()
        ? `/api/lembretes?busca=${encodeURIComponent(termo.trim())}`
        : "/api/lembretes";
      const resposta = await fetch(url, { cache: "no-store" });
      if (sessaoAcabou(resposta)) return;

      const dados = (await resposta.json()) as {
        pendentes: LembreteSerializado[];
        historico: LembreteSerializado[];
      };
      setPendentes(dados.pendentes);
      setHistorico(dados.historico);
    },
    [sessaoAcabou],
  );

  // A busca acontece no servidor de propósito: filtrar em memória só
  // alcançaria o que já estava na tela, e o histórico na tela é uma
  // janela dos mais recentes, não a tabela inteira.
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }

    const temporizador = setTimeout(() => void recarregar(busca), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(temporizador);
  }, [busca, recarregar]);

  function limparEstadosTransitorios(): void {
    setEditando(null);
    setConfirmandoExclusao(null);
    setConfirmandoLimpeza(false);
    setErroDeAcao(null);
  }

  /** Devolve a mensagem de erro do servidor, ou `null` em caso de sucesso. */
  async function chamar(url: string, init: RequestInit & { corpo?: unknown } = {}): Promise<string | null> {
    const { corpo, ...resto } = init;
    const resposta = await fetch(url, {
      ...resto,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });

    if (sessaoAcabou(resposta)) return null;

    if (!resposta.ok) {
      const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      return dados?.erro ?? "Não foi possível concluir a ação";
    }

    return null;
  }

  async function criar(corpo: CorpoDeLembrete): Promise<string | null> {
    const falha = await chamar("/api/lembretes", { method: "POST", corpo });
    if (!falha) await recarregar(busca);
    return falha;
  }

  async function salvarEdicao(id: string, corpo: CorpoDeLembrete): Promise<string | null> {
    const falha = await chamar(`/api/lembretes/${id}`, { method: "PATCH", corpo });
    if (falha) return falha;

    setEditando(null);
    await recarregar(busca);
    return null;
  }

  async function cancelar(id: string): Promise<void> {
    limparEstadosTransitorios();
    // Otimista: a linha some na hora e a lista se corrige no recarregar.
    setPendentes((atual) => atual.filter((l) => l.id !== id));

    const falha = await chamar(`/api/lembretes/${id}/cancelar`, { method: "POST" });
    if (falha) setErroDeAcao(falha);
    await recarregar(busca);
  }

  async function excluir(id: string): Promise<void> {
    limparEstadosTransitorios();
    setPendentes((atual) => atual.filter((l) => l.id !== id));
    setHistorico((atual) => atual.filter((l) => l.id !== id));

    const falha = await chamar(`/api/lembretes/${id}`, { method: "DELETE" });
    if (falha) setErroDeAcao(falha);
    await recarregar(busca);
  }

  async function limparHistorico(): Promise<void> {
    limparEstadosTransitorios();
    setHistorico([]);

    const falha = await chamar("/api/lembretes/historico", { method: "DELETE" });
    if (falha) setErroDeAcao(falha);
    await recarregar(busca);
  }

  const buscando = busca.trim().length > 0;

  return (
    <>
      <FormularioLembrete aoSubmeter={criar} />

      <div className="campo-busca">
        <IconeLupa />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nos seus lembretes"
          aria-label="Buscar nos seus lembretes"
          maxLength={200}
        />
        {buscando ? (
          <button type="button" className="link-discreto" onClick={() => setBusca("")}>
            Limpar
          </button>
        ) : null}
      </div>

      {erroDeAcao ? <p className="erro">{erroDeAcao}</p> : null}

      <p className="secao-titulo">Pendentes</p>
      <div className="cartao">
        {pendentes.length === 0 ? (
          <p className="lista-vazia">
            {buscando ? `Nenhum lembrete pendente com “${busca.trim()}”.` : "Nenhum lembrete pendente."}
          </p>
        ) : (
          pendentes.map((lembrete) =>
            editando === lembrete.id ? (
              <div className="item-lembrete em-edicao" key={lembrete.id}>
                <FormularioLembrete
                  modo="editar"
                  valoresIniciais={valoresDe(lembrete)}
                  aoSubmeter={(corpo) => salvarEdicao(lembrete.id, corpo)}
                  aoDesistir={() => setEditando(null)}
                />
              </div>
            ) : (
              <div className="item-lembrete" key={lembrete.id}>
                <div className="conteudo">
                  <p className="titulo">{lembrete.titulo}</p>
                  <p className="quando">{formatarQuando(lembrete.agendadoPara)}</p>
                  {lembrete.recorrencia ? <SeloRepeticao recorrencia={lembrete.recorrencia} /> : null}
                </div>
                <div className="acoes">
                  {confirmandoExclusao === lembrete.id ? null : (
                    <>
                      <button
                        type="button"
                        className="botao botao-secundario"
                        onClick={() => {
                          limparEstadosTransitorios();
                          setEditando(lembrete.id);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="botao botao-secundario"
                        onClick={() => void cancelar(lembrete.id)}
                      >
                        {lembrete.recorrencia ? "Encerrar" : "Cancelar"}
                      </button>
                    </>
                  )}
                  <BotaoApagar
                    rotulo=""
                    confirmando={confirmandoExclusao === lembrete.id}
                    aoPedirConfirmacao={() => {
                      setErroDeAcao(null);
                      setConfirmandoExclusao(lembrete.id);
                    }}
                    aoConfirmar={() => void excluir(lembrete.id)}
                    aoDesistir={() => setConfirmandoExclusao(null)}
                  />
                </div>
              </div>
            ),
          )
        )}
      </div>

      {historico.length > 0 || buscando ? (
        <>
          <p className="secao-titulo">Histórico</p>
          <div className="cartao">
            {historico.length === 0 ? (
              <p className="lista-vazia">Nada no histórico com “{busca.trim()}”.</p>
            ) : (
              historico.map((lembrete) => {
                const info = RESPONSAVEL_STATUS[lembrete.status] ?? {
                  rotulo: lembrete.status,
                  cor: "var(--text-tertiary)",
                };
                return (
                  <div className="item-lembrete" key={lembrete.id}>
                    <div className="conteudo">
                      <p className="titulo">{lembrete.titulo}</p>
                      <p className="quando">
                        {formatarQuando(lembrete.agendadoPara)}
                        {lembrete.recorrencia ? (
                          <span
                            className="marca-repeticao"
                            title={descreverRecorrencia(lembrete.recorrencia)}
                          >
                            <IconeRepetir />
                            {formatarHoraMinuto(lembrete.recorrencia.hora, lembrete.recorrencia.minuto)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="acoes">
                      {confirmandoExclusao === lembrete.id ? null : (
                        <span className="selo-status" style={{ ["--cor-status" as string]: info.cor }}>
                          {info.rotulo}
                        </span>
                      )}
                      <BotaoApagar
                        rotulo=""
                        confirmando={confirmandoExclusao === lembrete.id}
                        aoPedirConfirmacao={() => {
                          setErroDeAcao(null);
                          setConfirmandoExclusao(lembrete.id);
                        }}
                        aoConfirmar={() => void excluir(lembrete.id)}
                        aoDesistir={() => setConfirmandoExclusao(null)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Só sem busca ativa: "limpar" apaga o histórico inteiro, não
              os resultados na tela, e um botão que apaga mais do que
              mostra é uma armadilha. */}
          {historico.length > 0 && !buscando ? (
            <div className="rodape-lista">
              {confirmandoLimpeza ? (
                <div className="confirmacao">
                  <span>Apagar todo o histórico? Não dá para desfazer.</span>
                  <button
                    type="button"
                    className="botao botao-perigo compacto"
                    onClick={() => void limparHistorico()}
                  >
                    Apagar tudo
                  </button>
                  <button
                    type="button"
                    className="botao botao-secundario"
                    onClick={() => setConfirmandoLimpeza(false)}
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="link-sutil"
                  onClick={() => {
                    limparEstadosTransitorios();
                    setConfirmandoLimpeza(true);
                  }}
                >
                  Limpar histórico
                </button>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
