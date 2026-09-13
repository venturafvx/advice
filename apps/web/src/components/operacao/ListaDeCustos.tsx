"use client";

import { useRef, useState } from "react";
import type { CategoriaDeCustoDto } from "@advice/application";
import { ModoDeCusto } from "@advice/domain";
import { CampoDinheiro, CampoPercentual } from "./campos";

export interface LinhaDeCusto {
  /** Chave estável de React — não é persistida. */
  chave: string;
  categoriaId: string;
  modo: ModoDeCusto;
  valor: number;
}

const ROTULO_DO_MODO: Record<ModoDeCusto, string> = {
  [ModoDeCusto.VALOR_FIXO]: "Valor fixo",
  [ModoDeCusto.POR_UNIDADE]: "Por unidade",
  [ModoDeCusto.PERCENTUAL_DA_VENDA]: "% da venda",
};

export const MODOS_DE_COMPRA: ModoDeCusto[] = [
  ModoDeCusto.VALOR_FIXO,
  ModoDeCusto.POR_UNIDADE,
  ModoDeCusto.PERCENTUAL_DA_VENDA,
];

/** Serviço não tem lote — custo por unidade não se aplica (ver `Servico`). */
export const MODOS_DE_SERVICO: ModoDeCusto[] = [ModoDeCusto.VALOR_FIXO, ModoDeCusto.PERCENTUAL_DA_VENDA];

let contadorDeChaves = 0;
export function novaChave(): string {
  contadorDeChaves += 1;
  return `custo-${contadorDeChaves}`;
}

interface Props {
  categorias: CategoriaDeCustoDto[];
  linhas: LinhaDeCusto[];
  aoMudar: (linhas: LinhaDeCusto[]) => void;
  modosPermitidos: ModoDeCusto[];
  aoCriarCategoria: (categoria: CategoriaDeCustoDto) => void;
}

export function ListaDeCustos({ categorias, linhas, aoMudar, modosPermitidos, aoCriarCategoria }: Props) {
  const [criando, setCriando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [erroNovo, setErroNovo] = useState<string | null>(null);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const modoDoNovo = useRef<ModoDeCusto>(ModoDeCusto.VALOR_FIXO);

  const disponiveis = categorias.filter((c) => !c.arquivada);

  /**
   * As opções de uma linha são as categorias ativas **mais** a própria
   * categoria dela, ainda que arquivada. Sem isso, editar uma operação
   * antiga cujo custo aponta para uma categoria arquivada mostraria um
   * `select` sem a opção selecionada — o navegador exibe a primeira da
   * lista e o save troca a categoria sem ninguém perceber.
   */
  function opcoesPara(linha: LinhaDeCusto): CategoriaDeCustoDto[] {
    if (disponiveis.some((c) => c.id === linha.categoriaId)) {
      return disponiveis;
    }
    const arquivada = categorias.find((c) => c.id === linha.categoriaId);
    return arquivada ? [arquivada, ...disponiveis] : disponiveis;
  }

  function adicionar(): void {
    const primeira = disponiveis[0];
    if (!primeira) {
      setCriando(true);
      return;
    }
    aoMudar([...linhas, linhaParaCategoria(primeira, modosPermitidos)]);
  }

  function trocarCategoria(chave: string, categoriaId: string): void {
    const categoria = categorias.find((c) => c.id === categoriaId);
    if (!categoria) {
      return;
    }
    // Trocar a categoria repuxa o padrão dela (a "Taxa Amazon" já chega
    // com 15% da venda). É a diferença entre um formulário e uma
    // ferramenta que conhece a operação.
    aoMudar(
      linhas.map((linha) =>
        linha.chave === chave ? { ...linhaParaCategoria(categoria, modosPermitidos), chave } : linha,
      ),
    );
  }

  function trocarModo(chave: string, modo: ModoDeCusto): void {
    // O valor não sobrevive à troca de modo: 1500 é R$ 15,00 num modo e
    // 15% no outro — carregar o número seria transformar silenciosamente
    // um custo em outro.
    aoMudar(linhas.map((linha) => (linha.chave === chave ? { ...linha, modo, valor: 0 } : linha)));
  }

  function trocarValor(chave: string, valor: number): void {
    aoMudar(linhas.map((linha) => (linha.chave === chave ? { ...linha, valor } : linha)));
  }

  function remover(chave: string): void {
    aoMudar(linhas.filter((linha) => linha.chave !== chave));
  }

  async function criarCategoria(): Promise<void> {
    setErroNovo(null);
    setSalvandoNovo(true);
    try {
      const resposta = await fetch("/api/operacao/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeNovo, modoPadrao: modoDoNovo.current, valorPadrao: null }),
      });
      const dados = (await resposta.json()) as { categoria?: CategoriaDeCustoDto; erro?: string };

      if (!resposta.ok || !dados.categoria) {
        setErroNovo(dados.erro ?? "Não foi possível criar a categoria");
        return;
      }

      aoCriarCategoria(dados.categoria);
      aoMudar([...linhas, linhaParaCategoria(dados.categoria, modosPermitidos)]);
      setNomeNovo("");
      setCriando(false);
    } finally {
      setSalvandoNovo(false);
    }
  }

  return (
    <div className="bloco-custos">
      <div className="bloco-custos-cabecalho">
        <span className="rotulo-secao">Custos da operação</span>
        <button type="button" className="botao botao-fantasma" onClick={adicionar}>
          + Custo
        </button>
      </div>

      {linhas.length === 0 && !criando ? (
        <p className="dica">
          Frete, etiquetagem, taxa da Amazon, embalagem — cada um entra do jeito que incide de verdade, e a
          margem ao lado acompanha.
        </p>
      ) : null}

      {linhas.map((linha) => {
        const percentual = linha.modo === ModoDeCusto.PERCENTUAL_DA_VENDA;
        const opcoes = opcoesPara(linha);
        const nomeDaLinha = opcoes.find((c) => c.id === linha.categoriaId)?.nome ?? "custo";
        return (
          <div className="linha-custo" key={linha.chave}>
            <select
              aria-label="Categoria do custo"
              value={linha.categoriaId}
              onChange={(evento) => trocarCategoria(linha.chave, evento.target.value)}
            >
              {opcoes.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                  {categoria.arquivada ? " (arquivado)" : ""}
                </option>
              ))}
            </select>

            <select
              aria-label="Como o custo incide"
              value={linha.modo}
              onChange={(evento) => trocarModo(linha.chave, evento.target.value as ModoDeCusto)}
            >
              {modosPermitidos.map((modo) => (
                <option key={modo} value={modo}>
                  {ROTULO_DO_MODO[modo]}
                </option>
              ))}
            </select>

            {percentual ? (
              <CampoPercentual
                aria-label="Percentual"
                pontosBase={linha.valor}
                aoMudar={(v) => trocarValor(linha.chave, v)}
              />
            ) : (
              <CampoDinheiro
                aria-label="Valor do custo"
                valor={linha.valor}
                aoMudar={(v) => trocarValor(linha.chave, v)}
              />
            )}

            <button
              type="button"
              className="botao-icone"
              onClick={() => remover(linha.chave)}
              aria-label={`Remover custo ${nomeDaLinha}`}
              title="Remover"
            >
              ×
            </button>
          </div>
        );
      })}

      {criando ? (
        <div className="nova-categoria">
          <input
            value={nomeNovo}
            onChange={(evento) => setNomeNovo(evento.target.value)}
            placeholder="Nome do custo (ex: Comissão do marketplace)"
            maxLength={60}
            autoFocus
          />
          <select
            aria-label="Como esse custo incide por padrão"
            defaultValue={ModoDeCusto.VALOR_FIXO}
            onChange={(evento) => {
              modoDoNovo.current = evento.target.value as ModoDeCusto;
            }}
          >
            {modosPermitidos.map((modo) => (
              <option key={modo} value={modo}>
                {ROTULO_DO_MODO[modo]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="botao botao-secundario"
            disabled={salvandoNovo || nomeNovo.trim().length === 0}
            onClick={() => void criarCategoria()}
          >
            {salvandoNovo ? "Criando…" : "Criar"}
          </button>
          <button
            type="button"
            className="botao-icone"
            onClick={() => setCriando(false)}
            aria-label="Cancelar"
          >
            ×
          </button>
        </div>
      ) : (
        <button type="button" className="link-sutil" onClick={() => setCriando(true)}>
          Criar um tipo de custo novo
        </button>
      )}

      {erroNovo ? <p className="erro">{erroNovo}</p> : null}
    </div>
  );
}

function linhaParaCategoria(categoria: CategoriaDeCustoDto, modosPermitidos: ModoDeCusto[]): LinhaDeCusto {
  const modo = modosPermitidos.includes(categoria.modoPadrao)
    ? categoria.modoPadrao
    : (modosPermitidos[0] ?? ModoDeCusto.VALOR_FIXO);

  return {
    chave: novaChave(),
    categoriaId: categoria.id,
    modo,
    // Só reaproveita o valor padrão se o modo sobreviveu — um padrão de
    // 15% não faz sentido reaproveitado como R$ 0,15.
    valor: modo === categoria.modoPadrao ? (categoria.valorPadrao ?? 0) : 0,
  };
}
