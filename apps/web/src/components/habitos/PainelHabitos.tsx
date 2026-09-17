"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SituacaoDoDia } from "@advice/domain";
import type { HabitoDto, PainelDeHabitosDto } from "@advice/application";
import { descreverAderencia, descreverCadencia, descreverJanela, descreverProgressoDaSemana, descreverSequencia, formatarAderencia } from "@/lib/cadencia";
import { FormularioHabito, valoresDe, type CorpoDeHabito } from "@/components/habitos/FormularioHabito";
import { RegistroDeQuebra } from "@/components/habitos/RegistroDeQuebra";
import {
  FaixaDaSemana,
  IconeArquivar,
  IconeCheck,
  IconeQuebra,
  SeloDeSequencia,
  formatarDiaComSemana,
} from "@/components/habitos/habitos-ui";
import { IconeLixeira } from "@/components/lembretes-ui";

/**
 * A tela de hábitos.
 *
 * A ordem dos blocos é a ordem da intenção: primeiro o que hoje pede,
 * depois como a semana está indo, e por último o que foi escrito nas
 * quebras. Formulário de criação fica no fim — criar hábito é raro,
 * ticar é diário, e quem abre o app dez vezes por semana não deve
 * encontrar um formulário vazio na frente das dez.
 */
export function PainelHabitos({ painelInicial }: { painelInicial: PainelDeHabitosDto }) {
  const router = useRouter();
  const [painel, setPainel] = useState(painelInicial);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [quebrando, setQuebrando] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);

  const ativos = painel.habitos.filter((habito) => !habito.arquivado);
  const arquivados = painel.habitos.filter((habito) => habito.arquivado);
  const paraHoje = ativos.filter((habito) => habito.desempenho.cobrarHoje);
  const resolvidosHoje = ativos.filter((habito) => habito.hoje !== null);

  /**
   * A sessão pode vencer com a aba aberta. Sem isto, a próxima ação
   * falharia em silêncio em vez de levar de volta para o login.
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

  const recarregar = useCallback(async (): Promise<void> => {
    const resposta = await fetch("/api/habitos", { cache: "no-store" });
    if (sessaoAcabou(resposta)) return;
    setPainel((await resposta.json()) as PainelDeHabitosDto);
  }, [sessaoAcabou]);

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

  function limparEstadosTransitorios(): void {
    setEditando(null);
    setQuebrando(null);
    setConfirmandoExclusao(null);
    setErroDeAcao(null);
  }

  async function agirERecarregar(executar: () => Promise<string | null>): Promise<string | null> {
    const falha = await executar();
    // Recarrega o painel inteiro mesmo em caso de falha: o erro pode ser
    // "esse hábito não existe mais", e a tela precisa parar de mostrá-lo.
    await recarregar();
    return falha;
  }

  async function criar(corpo: CorpoDeHabito): Promise<string | null> {
    const falha = await agirERecarregar(() => chamar("/api/habitos", { method: "POST", corpo }));
    if (!falha) setCriando(false);
    return falha;
  }

  async function salvarEdicao(id: string, corpo: CorpoDeHabito): Promise<string | null> {
    const falha = await agirERecarregar(() => chamar(`/api/habitos/${id}`, { method: "PUT", corpo }));
    if (!falha) setEditando(null);
    return falha;
  }

  async function registrar(
    id: string,
    situacao: SituacaoDoDia,
    notas: { observacao: string | null; pensamento: string | null } = { observacao: null, pensamento: null },
  ): Promise<string | null> {
    limparEstadosTransitorios();
    const falha = await agirERecarregar(() =>
      chamar(`/api/habitos/${id}/registros`, {
        method: "PUT",
        corpo: { dia: painel.hoje, situacao, ...notas },
      }),
    );
    if (falha) setErroDeAcao(falha);
    return falha;
  }

  async function desfazerHoje(id: string): Promise<void> {
    limparEstadosTransitorios();
    const falha = await agirERecarregar(() =>
      chamar(`/api/habitos/${id}/registros?dia=${encodeURIComponent(painel.hoje)}`, { method: "DELETE" }),
    );
    if (falha) setErroDeAcao(falha);
  }

  async function definirArquivamento(id: string, arquivado: boolean): Promise<void> {
    limparEstadosTransitorios();
    const falha = await agirERecarregar(() =>
      chamar(`/api/habitos/${id}`, { method: "PATCH", corpo: { arquivado } }),
    );
    if (falha) setErroDeAcao(falha);
  }

  async function excluir(id: string): Promise<void> {
    limparEstadosTransitorios();
    const falha = await agirERecarregar(() => chamar(`/api/habitos/${id}`, { method: "DELETE" }));
    if (falha) setErroDeAcao(falha);
  }

  return (
    <>
      {erroDeAcao ? <p className="erro">{erroDeAcao}</p> : null}

      <section aria-labelledby="titulo-hoje">
        <p className="secao-titulo" id="titulo-hoje">
          Hoje · {formatarDiaComSemana(painel.hoje)}
        </p>
        <div className="cartao">
          {ativos.length === 0 ? (
            <p className="lista-vazia">Crie seu primeiro hábito lá embaixo — ele aparece aqui amanhã cedo.</p>
          ) : paraHoje.length === 0 && resolvidosHoje.length === 0 ? (
            <p className="lista-vazia">Nenhum hábito cobra hoje. Dia livre — e isso também é parte do plano.</p>
          ) : null}

          {paraHoje.map((habito) =>
            quebrando === habito.id ? (
              <RegistroDeQuebra
                key={habito.id}
                habito={habito}
                aoRegistrar={(notas) => registrar(habito.id, SituacaoDoDia.QUEBRADO, notas)}
                aoDesistir={() => setQuebrando(null)}
              />
            ) : (
              <div className="linha-hoje" key={habito.id}>
                <div className="conteudo">
                  <p className="titulo">{habito.nome}</p>
                  <p className="sublinha">
                    {descreverCadencia(habito.cadencia)}
                    {habito.cadencia.frequencia === "VEZES_POR_SEMANA"
                      ? ` · ${descreverProgressoDaSemana(habito.desempenho)}`
                      : null}
                    {habito.desempenho.sequencia > 0 ? ` · ${descreverSequencia(habito.desempenho)}` : null}
                  </p>
                </div>
                <div className="acoes">
                  <button
                    type="button"
                    className="botao botao-feito"
                    onClick={() => void registrar(habito.id, SituacaoDoDia.FEITO)}
                  >
                    <IconeCheck />
                    Feito
                  </button>
                  <button
                    type="button"
                    className="botao botao-secundario"
                    onClick={() => {
                      limparEstadosTransitorios();
                      setQuebrando(habito.id);
                    }}
                  >
                    Quebrei
                  </button>
                </div>
              </div>
            ),
          )}

          {resolvidosHoje.map((habito) => (
            <div className="linha-hoje resolvida" key={habito.id}>
              <div className="conteudo">
                <p className="titulo">
                  <span
                    className="marca-situacao"
                    data-situacao={habito.hoje?.situacao === SituacaoDoDia.FEITO ? "feito" : "quebrado"}
                    aria-hidden="true"
                  >
                    {habito.hoje?.situacao === SituacaoDoDia.FEITO ? <IconeCheck /> : <IconeQuebra />}
                  </span>
                  {habito.nome}
                </p>
                <p className="sublinha">
                  {habito.hoje?.situacao === SituacaoDoDia.FEITO ? "Cumprido hoje" : "Quebrado hoje"}
                  {habito.hoje?.observacao ? ` · ${habito.hoje.observacao}` : null}
                </p>
              </div>
              <div className="acoes">
                <button
                  type="button"
                  className="link-sutil"
                  onClick={() => void desfazerHoje(habito.id)}
                >
                  Desfazer
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {ativos.length > 0 ? (
        <section aria-labelledby="titulo-habitos">
          <p className="secao-titulo" id="titulo-habitos">
            Seus hábitos
          </p>
          {ativos.map((habito) =>
            editando === habito.id ? (
              <div className="cartao-habito em-edicao" key={habito.id}>
                <FormularioHabito
                  modo="editar"
                  valoresIniciais={valoresDe(habito)}
                  aoSubmeter={(corpo) => salvarEdicao(habito.id, corpo)}
                  aoDesistir={() => setEditando(null)}
                />
              </div>
            ) : (
              <CartaoDeHabito
                key={habito.id}
                habito={habito}
                hoje={painel.hoje}
                confirmandoExclusao={confirmandoExclusao === habito.id}
                aoEditar={() => {
                  limparEstadosTransitorios();
                  setEditando(habito.id);
                }}
                aoArquivar={() => void definirArquivamento(habito.id, true)}
                aoPedirExclusao={() => {
                  limparEstadosTransitorios();
                  setConfirmandoExclusao(habito.id);
                }}
                aoConfirmarExclusao={() => void excluir(habito.id)}
                aoDesistirDaExclusao={() => setConfirmandoExclusao(null)}
              />
            ),
          )}
        </section>
      ) : null}

      {painel.quebras.length > 0 ? (
        <section aria-labelledby="titulo-quebras">
          <p className="secao-titulo" id="titulo-quebras">
            Quando você quebrou
          </p>
          <div className="cartao diario">
            {painel.quebras.map((quebra) => (
              <article className="quebra" key={`${quebra.habitoId}-${quebra.dia}`}>
                <header>
                  <span className="quebra-habito">{quebra.habitoNome}</span>
                  <span className="quebra-dia">{formatarDiaComSemana(quebra.dia)}</span>
                </header>
                {quebra.observacao ? <p className="quebra-fato">{quebra.observacao}</p> : null}
                {quebra.pensamento ? (
                  <blockquote className="quebra-pensamento">{quebra.pensamento}</blockquote>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="titulo-novo">
        <div className="secao-cabecalho">
          <p className="secao-titulo" id="titulo-novo">
            Novo hábito
          </p>
          {ativos.length > 0 ? (
            <button type="button" className="link-sutil" onClick={() => setCriando((atual) => !atual)}>
              {criando ? "Fechar" : "Criar hábito"}
            </button>
          ) : null}
        </div>
        {/* Sem nenhum hábito, o formulário já vem aberto: a tela vazia
            tem exatamente uma coisa a oferecer, e escondê-la atrás de um
            clique seria enfeite. */}
        {criando || ativos.length === 0 ? <FormularioHabito aoSubmeter={criar} /> : null}
      </section>

      {arquivados.length > 0 ? (
        <section aria-labelledby="titulo-arquivados">
          <div className="secao-cabecalho">
            <p className="secao-titulo" id="titulo-arquivados">
              Arquivados
            </p>
            <button
              type="button"
              className="link-sutil"
              onClick={() => setMostrarArquivados((atual) => !atual)}
              aria-expanded={mostrarArquivados}
            >
              {mostrarArquivados ? "Esconder" : `Ver ${arquivados.length}`}
            </button>
          </div>
          {mostrarArquivados ? (
            <div className="cartao">
              {arquivados.map((habito) => (
                <div className="linha-hoje" key={habito.id}>
                  <div className="conteudo">
                    <p className="titulo">{habito.nome}</p>
                    <p className="sublinha">{descreverCadencia(habito.cadencia)} · arquivado</p>
                  </div>
                  <div className="acoes">
                    {confirmandoExclusao === habito.id ? (
                      <div className="confirmacao">
                        <span>Apagar com todo o histórico?</span>
                        <button
                          type="button"
                          className="botao botao-perigo compacto"
                          onClick={() => void excluir(habito.id)}
                        >
                          Apagar
                        </button>
                        <button
                          type="button"
                          className="botao botao-secundario"
                          onClick={() => setConfirmandoExclusao(null)}
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="botao botao-secundario"
                          onClick={() => void definirArquivamento(habito.id, false)}
                        >
                          Reativar
                        </button>
                        <button
                          type="button"
                          className="botao-icone"
                          title="Apagar hábito e histórico"
                          aria-label={`Apagar ${habito.nome} e todo o histórico`}
                          onClick={() => {
                            limparEstadosTransitorios();
                            setConfirmandoExclusao(habito.id);
                          }}
                        >
                          <IconeLixeira />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function CartaoDeHabito({
  habito,
  hoje,
  confirmandoExclusao,
  aoEditar,
  aoArquivar,
  aoPedirExclusao,
  aoConfirmarExclusao,
  aoDesistirDaExclusao,
}: {
  habito: HabitoDto;
  hoje: string;
  confirmandoExclusao: boolean;
  aoEditar: () => void;
  aoArquivar: () => void;
  aoPedirExclusao: () => void;
  aoConfirmarExclusao: () => void;
  aoDesistirDaExclusao: () => void;
}) {
  return (
    <article className="cartao-habito">
      <div className="cartao-habito-topo">
        <div>
          <h3>{habito.nome}</h3>
          <p className="sublinha">{descreverCadencia(habito.cadencia)}</p>
        </div>
        <SeloDeSequencia habito={habito} />
      </div>

      <FaixaDaSemana semana={habito.semana} hoje={hoje} />

      <div className="cartao-habito-numeros">
        <span>
          <strong>{descreverSequencia(habito.desempenho)}</strong>
        </span>
        <span title={descreverAderencia(habito.desempenho)}>
          {formatarAderencia(habito.desempenho)} · {descreverJanela(habito.desempenho)}
        </span>
      </div>

      {habito.motivacao ? <p className="cartao-habito-motivo">{habito.motivacao}</p> : null}

      <div className="cartao-habito-acoes">
        {confirmandoExclusao ? (
          <div className="confirmacao">
            <span>Apagar o hábito e todo o histórico? Não dá para desfazer.</span>
            <button type="button" className="botao botao-perigo compacto" onClick={aoConfirmarExclusao}>
              Apagar
            </button>
            <button type="button" className="botao botao-secundario" onClick={aoDesistirDaExclusao}>
              Não
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="botao botao-secundario" onClick={aoEditar}>
              Editar
            </button>
            <button type="button" className="botao botao-secundario" onClick={aoArquivar}>
              <IconeArquivar />
              Arquivar
            </button>
            <button
              type="button"
              className="botao-icone"
              title="Apagar hábito e histórico"
              aria-label={`Apagar ${habito.nome} e todo o histórico`}
              onClick={aoPedirExclusao}
            >
              <IconeLixeira />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
