"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CategoriaDeCustoDto, CompraDto } from "@advice/application";
import { calcularResultado } from "@advice/domain";
import { hojeComoValorDeCampoData, paraValorDeCampoData } from "@/lib/formato";
import { caminhoDoNegocio, perfilDe, type PerfilDeNegocio } from "@/lib/negocios";
import { CampoDinheiro, CampoInteiro } from "./campos";
import { SeletorDeNegocioDoLancamento } from "./SeletorDeNegocioDoLancamento";
import { ListaDeCustos, MODOS_DE_COMPRA, novaChave, type LinhaDeCusto } from "./ListaDeCustos";
import { PainelResultado } from "./PainelResultado";

interface Props {
  categoriasIniciais: CategoriaDeCustoDto[];
  /** O negócio da rota: é ele quem define o padrão e para onde voltar. */
  perfil: PerfilDeNegocio;
  compra?: CompraDto;
}

export function EditorDeCompra({ categoriasIniciais, perfil, compra }: Props) {
  const router = useRouter();
  const editando = compra !== undefined;

  const [categorias, setCategorias] = useState(categoriasIniciais);
  // Editável de propósito: lançar no negócio errado é o engano mais
  // fácil de cometer aqui, e sem este campo a única saída seria apagar
  // e redigitar tudo.
  const [negocio, setNegocio] = useState(compra?.negocio ?? perfil.negocio);
  const [descricao, setDescricao] = useState(compra?.descricao ?? "");
  const [compradoEm, setCompradoEm] = useState(
    compra ? paraValorDeCampoData(compra.compradoEm) : hojeComoValorDeCampoData(),
  );
  const [quantidade, setQuantidade] = useState(compra?.quantidade ?? 1);
  const [custoUnitario, setCustoUnitario] = useState(compra?.custoUnitarioCentavos ?? 0);
  const [precoVenda, setPrecoVenda] = useState(compra?.precoVendaUnitarioCentavos ?? 0);
  const [observacao, setObservacao] = useState(compra?.observacao ?? "");
  const [custos, setCustos] = useState<LinhaDeCusto[]>(
    () => compra?.custos.map((custo) => ({ chave: novaChave(), ...custo })) ?? [],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  // Volta para o painel do negócio em que o lançamento **ficou**, não
  // para o de onde se entrou. Mover uma compra de negócio e cair num
  // painel onde ela não aparece pareceria que a edição se perdeu.
  const destino = caminhoDoNegocio(perfilDe(negocio));

  /**
   * O simulador ao vivo. Chama exatamente a mesma função do domínio que
   * o servidor usa para persistir — o número que aparece enquanto se
   * digita é o mesmo que vai para o banco, não uma aproximação de UI.
   */
  const resultado = useMemo(
    () =>
      calcularResultado({
        quantidade: Math.max(1, quantidade),
        custoUnitarioCentavos: custoUnitario,
        precoVendaUnitarioCentavos: precoVenda,
        custos: custos.map((linha) => ({
          rotulo: categorias.find((c) => c.id === linha.categoriaId)?.nome ?? "Custo",
          modo: linha.modo,
          valor: linha.valor,
        })),
      }),
    [quantidade, custoUnitario, precoVenda, custos, categorias],
  );

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const resposta = await fetch(
        editando ? `/api/operacao/compras/${compra.id}` : "/api/operacao/compras",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            negocio,
            descricao,
            quantidade,
            custoUnitarioCentavos: custoUnitario,
            precoVendaUnitarioCentavos: precoVenda,
            compradoEm,
            observacao: observacao.trim() || null,
            custos: custos.map(({ categoriaId, modo, valor }) => ({ categoriaId, modo, valor })),
          }),
        },
      );

      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível salvar a compra");
        return;
      }

      router.push(destino);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(): Promise<void> {
    if (!editando) return;

    const resposta = await fetch(`/api/operacao/compras/${compra.id}`, { method: "DELETE" });
    if (resposta.ok) {
      router.push(caminhoDoNegocio(perfilDe(compra.negocio)));
      router.refresh();
    } else {
      setConfirmandoExclusao(false);
      setErro("Não foi possível excluir a compra");
    }
  }

  return (
    <form className="editor" onSubmit={aoSubmeter}>
      <div className="cartao">
        <SeletorDeNegocioDoLancamento valor={negocio} aoMudar={setNegocio} />

        <div className="campo">
          <label htmlFor="descricao">O que você comprou</label>
          <input
            id="descricao"
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder={perfil.exemploCompra}
            maxLength={200}
            required
            autoFocus={!editando}
          />
        </div>

        <div className="linha">
          <div className="campo">
            <label htmlFor="compradoEm">Data da compra</label>
            <input
              id="compradoEm"
              type="date"
              value={compradoEm}
              onChange={(evento) => setCompradoEm(evento.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="quantidade">Quantidade</label>
            <CampoInteiro id="quantidade" valor={quantidade} aoMudar={setQuantidade} />
          </div>
        </div>

        <div className="linha">
          <div className="campo">
            <label htmlFor="custoUnitario">Custo por unidade</label>
            <CampoDinheiro id="custoUnitario" valor={custoUnitario} aoMudar={setCustoUnitario} />
          </div>
          <div className="campo">
            <label htmlFor="precoVenda">Preço de venda por unidade</label>
            <CampoDinheiro id="precoVenda" valor={precoVenda} aoMudar={setPrecoVenda} />
          </div>
        </div>

        <ListaDeCustos
          categorias={categorias}
          linhas={custos}
          aoMudar={setCustos}
          modosPermitidos={MODOS_DE_COMPRA}
          aoCriarCategoria={(categoria) => setCategorias((atuais) => [...atuais, categoria])}
        />

        <div className="campo campo-observacao">
          <label htmlFor="observacao">Observação (opcional)</label>
          <textarea
            id="observacao"
            rows={2}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            placeholder="Fornecedor, condição de pagamento, o que for útil lembrar"
            maxLength={2000}
          />
        </div>

        {erro ? <p className="erro">{erro}</p> : null}

        <div className="acoes-editor">
          <button type="submit" className="botao botao-primario" disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar compra"}
          </button>
          <Link href={destino} className="botao botao-secundario">
            Cancelar
          </Link>
          {editando ? (
            confirmandoExclusao ? (
              <div className="confirmacao">
                <span>Apagar a compra e os custos dela?</span>
                <button type="button" className="botao botao-perigo compacto" onClick={() => void excluir()}>
                  Apagar
                </button>
                <button
                  type="button"
                  className="botao botao-secundario"
                  onClick={() => setConfirmandoExclusao(false)}
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="botao botao-perigo"
                onClick={() => setConfirmandoExclusao(true)}
              >
                Excluir
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className="coluna-resultado">
        <PainelResultado resultado={resultado} quantidade={Math.max(1, quantidade)} />
      </div>
    </form>
  );
}
