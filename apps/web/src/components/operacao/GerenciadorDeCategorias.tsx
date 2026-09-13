"use client";

import { useState, type FormEvent } from "react";
import type { CategoriaDeCustoDto } from "@advice/application";
import { ModoDeCusto } from "@advice/domain";
import { formatarDinheiro, formatarPontosBase } from "@/lib/formato";
import { CampoDinheiro, CampoPercentual } from "./campos";

const ROTULO_DO_MODO: Record<ModoDeCusto, string> = {
  [ModoDeCusto.VALOR_FIXO]: "Valor fixo",
  [ModoDeCusto.POR_UNIDADE]: "Por unidade",
  [ModoDeCusto.PERCENTUAL_DA_VENDA]: "% da venda",
};

const MODOS: ModoDeCusto[] = [
  ModoDeCusto.VALOR_FIXO,
  ModoDeCusto.POR_UNIDADE,
  ModoDeCusto.PERCENTUAL_DA_VENDA,
];

export function GerenciadorDeCategorias({
  categoriasIniciais,
}: {
  categoriasIniciais: CategoriaDeCustoDto[];
}) {
  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [nome, setNome] = useState("");
  const [modoPadrao, setModoPadrao] = useState<ModoDeCusto>(ModoDeCusto.VALOR_FIXO);
  const [valorPadrao, setValorPadrao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function substituir(categoria: CategoriaDeCustoDto): void {
    // Reordena: renomear "Zinco" para "Adesivo" precisa mover a linha,
    // senão a lista deixa de estar em ordem alfabética na hora.
    setCategorias((atuais) => atuais.map((c) => (c.id === categoria.id ? categoria : c)).sort(porNome));
  }

  async function criar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const resposta = await fetch("/api/operacao/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, modoPadrao, valorPadrao: valorPadrao > 0 ? valorPadrao : null }),
      });
      const dados = (await resposta.json()) as { categoria?: CategoriaDeCustoDto; erro?: string };

      if (!resposta.ok || !dados.categoria) {
        setErro(dados.erro ?? "Não foi possível criar a categoria");
        return;
      }

      setCategorias((atuais) => [...atuais, dados.categoria as CategoriaDeCustoDto].sort(porNome));
      setNome("");
      setValorPadrao(0);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCategoria(
    id: string,
    dados: { nome: string; modoPadrao: ModoDeCusto; valorPadrao: number | null },
  ): Promise<boolean> {
    setErro(null);
    const resposta = await fetch(`/api/operacao/categorias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const retorno = (await resposta.json()) as { categoria?: CategoriaDeCustoDto; erro?: string };

    if (!resposta.ok || !retorno.categoria) {
      setErro(retorno.erro ?? "Não foi possível salvar a categoria");
      return false;
    }

    substituir(retorno.categoria);
    return true;
  }

  async function alternarArquivamento(categoria: CategoriaDeCustoDto): Promise<void> {
    setErro(null);
    const resposta = await fetch(`/api/operacao/categorias/${categoria.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivada: !categoria.arquivada }),
    });
    const dados = (await resposta.json()) as { categoria?: CategoriaDeCustoDto; erro?: string };

    if (!resposta.ok || !dados.categoria) {
      setErro(dados.erro ?? "Não foi possível atualizar a categoria");
      return;
    }
    substituir(dados.categoria);
  }

  const ativas = categorias.filter((c) => !c.arquivada);
  const arquivadas = categorias.filter((c) => c.arquivada);

  return (
    <>
      <form className="cartao" onSubmit={criar}>
        <div className="campo">
          <label htmlFor="nome">Nome do custo</label>
          <input
            id="nome"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex: Comissão do marketplace"
            maxLength={60}
            required
          />
        </div>

        <div className="linha">
          <div className="campo">
            <label htmlFor="modo">Como costuma incidir</label>
            <select
              id="modo"
              value={modoPadrao}
              onChange={(evento) => {
                setModoPadrao(evento.target.value as ModoDeCusto);
                setValorPadrao(0);
              }}
            >
              {MODOS.map((modo) => (
                <option key={modo} value={modo}>
                  {ROTULO_DO_MODO[modo]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="valorPadrao">Valor sugerido (opcional)</label>
            {modoPadrao === ModoDeCusto.PERCENTUAL_DA_VENDA ? (
              <CampoPercentual id="valorPadrao" pontosBase={valorPadrao} aoMudar={setValorPadrao} />
            ) : (
              <CampoDinheiro id="valorPadrao" valor={valorPadrao} aoMudar={setValorPadrao} />
            )}
          </div>
        </div>

        {erro ? <p className="erro">{erro}</p> : null}

        <button
          type="submit"
          className="botao botao-primario"
          disabled={salvando || nome.trim().length === 0}
        >
          {salvando ? "Criando…" : "Criar tipo de custo"}
        </button>
      </form>

      <p className="secao-titulo">Em uso</p>
      <div className="cartao">
        {ativas.length === 0 ? (
          <p className="lista-vazia">Nenhum tipo de custo ativo.</p>
        ) : (
          ativas.map((categoria) => (
            <ItemCategoria
              key={categoria.id}
              categoria={categoria}
              aoAlternar={alternarArquivamento}
              aoSalvar={salvarCategoria}
            />
          ))
        )}
      </div>

      {arquivadas.length > 0 ? (
        <>
          <p className="secao-titulo">Arquivados</p>
          <div className="cartao">
            {arquivadas.map((categoria) => (
              <ItemCategoria
                key={categoria.id}
                categoria={categoria}
                aoAlternar={alternarArquivamento}
                aoSalvar={salvarCategoria}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function ItemCategoria({
  categoria,
  aoAlternar,
  aoSalvar,
}: {
  categoria: CategoriaDeCustoDto;
  aoAlternar: (categoria: CategoriaDeCustoDto) => Promise<void>;
  aoSalvar: (
    id: string,
    dados: { nome: string; modoPadrao: ModoDeCusto; valorPadrao: number | null },
  ) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(categoria.nome);
  const [modoPadrao, setModoPadrao] = useState(categoria.modoPadrao);
  const [valorPadrao, setValorPadrao] = useState(categoria.valorPadrao ?? 0);
  const [salvando, setSalvando] = useState(false);

  function cancelar(): void {
    setNome(categoria.nome);
    setModoPadrao(categoria.modoPadrao);
    setValorPadrao(categoria.valorPadrao ?? 0);
    setEditando(false);
  }

  async function salvar(): Promise<void> {
    setSalvando(true);
    try {
      const ok = await aoSalvar(categoria.id, {
        nome,
        modoPadrao,
        valorPadrao: valorPadrao > 0 ? valorPadrao : null,
      });
      if (ok) {
        setEditando(false);
      }
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <div className="item-lembrete editando">
        <div className="conteudo edicao-categoria">
          <input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            maxLength={60}
            aria-label="Nome da categoria"
            autoFocus
          />
          <select
            aria-label="Como costuma incidir"
            value={modoPadrao}
            onChange={(evento) => {
              setModoPadrao(evento.target.value as ModoDeCusto);
              setValorPadrao(0);
            }}
          >
            {MODOS.map((modo) => (
              <option key={modo} value={modo}>
                {ROTULO_DO_MODO[modo]}
              </option>
            ))}
          </select>
          {modoPadrao === ModoDeCusto.PERCENTUAL_DA_VENDA ? (
            <CampoPercentual
              aria-label="Percentual sugerido"
              pontosBase={valorPadrao}
              aoMudar={setValorPadrao}
            />
          ) : (
            <CampoDinheiro aria-label="Valor sugerido" valor={valorPadrao} aoMudar={setValorPadrao} />
          )}
        </div>
        <div className="acoes">
          <button
            type="button"
            className="botao botao-secundario"
            disabled={salvando || nome.trim().length === 0}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" className="botao-icone" onClick={cancelar} aria-label="Cancelar edição">
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="item-lembrete">
      <div className="conteudo">
        <p className="titulo">{categoria.nome}</p>
        <p className="quando">
          {ROTULO_DO_MODO[categoria.modoPadrao]}
          {categoria.valorPadrao !== null
            ? ` · sugere ${
                categoria.modoPadrao === ModoDeCusto.PERCENTUAL_DA_VENDA
                  ? formatarPontosBase(categoria.valorPadrao)
                  : formatarDinheiro(categoria.valorPadrao)
              }`
            : ""}
        </p>
      </div>
      <div className="acoes">
        <button type="button" className="botao botao-secundario" onClick={() => setEditando(true)}>
          Editar
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => void aoAlternar(categoria)}>
          {categoria.arquivada ? "Reativar" : "Arquivar"}
        </button>
      </div>
    </div>
  );
}

function porNome(a: CategoriaDeCustoDto, b: CategoriaDeCustoDto): number {
  return a.nome.localeCompare(b.nome, "pt-BR");
}
