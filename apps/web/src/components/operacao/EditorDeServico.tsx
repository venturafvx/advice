"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CategoriaDeCustoDto, ServicoDto } from "@advice/application";
import { calcularResultado } from "@advice/domain";
import { hojeComoValorDeCampoData, paraValorDeCampoData } from "@/lib/formato";
import { CampoDinheiro } from "./campos";
import { ListaDeCustos, MODOS_DE_SERVICO, novaChave, type LinhaDeCusto } from "./ListaDeCustos";
import { PainelResultado } from "./PainelResultado";

interface Props {
  categoriasIniciais: CategoriaDeCustoDto[];
  servico?: ServicoDto;
}

export function EditorDeServico({ categoriasIniciais, servico }: Props) {
  const router = useRouter();
  const editando = servico !== undefined;

  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [descricao, setDescricao] = useState(servico?.descricao ?? "");
  const [cliente, setCliente] = useState(servico?.cliente ?? "");
  const [recebidoEm, setRecebidoEm] = useState(
    servico ? paraValorDeCampoData(servico.recebidoEm) : hojeComoValorDeCampoData(),
  );
  const [valorRecebido, setValorRecebido] = useState(servico?.valorRecebidoCentavos ?? 0);
  const [observacao, setObservacao] = useState(servico?.observacao ?? "");
  const [custos, setCustos] = useState<LinhaDeCusto[]>(
    () => servico?.custos.map((custo) => ({ chave: novaChave(), ...custo })) ?? [],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const resultado = useMemo(
    () =>
      calcularResultado({
        quantidade: 1,
        custoUnitarioCentavos: 0,
        precoVendaUnitarioCentavos: valorRecebido,
        custos: custos.map((linha) => ({
          rotulo: categorias.find((c) => c.id === linha.categoriaId)?.nome ?? "Custo",
          modo: linha.modo,
          valor: linha.valor,
        })),
      }),
    [valorRecebido, custos, categorias],
  );

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const resposta = await fetch(
        editando ? `/api/operacao/servicos/${servico.id}` : "/api/operacao/servicos",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descricao,
            cliente: cliente.trim() || null,
            valorRecebidoCentavos: valorRecebido,
            recebidoEm,
            observacao: observacao.trim() || null,
            custos: custos.map(({ categoriaId, modo, valor }) => ({ categoriaId, modo, valor })),
          }),
        },
      );

      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível salvar o serviço");
        return;
      }

      router.push("/operacao");
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(): Promise<void> {
    if (!editando || !window.confirm("Excluir este serviço e os custos dele?")) {
      return;
    }
    const resposta = await fetch(`/api/operacao/servicos/${servico.id}`, { method: "DELETE" });
    if (resposta.ok) {
      router.push("/operacao");
      router.refresh();
    } else {
      setErro("Não foi possível excluir o serviço");
    }
  }

  return (
    <form className="editor" onSubmit={aoSubmeter}>
      <div className="cartao">
        <div className="campo">
          <label htmlFor="descricao">O serviço</label>
          <input
            id="descricao"
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder="Ex: Papel de parede — sala, 18 m²"
            maxLength={200}
            required
            autoFocus={!editando}
          />
        </div>

        <div className="linha">
          <div className="campo">
            <label htmlFor="cliente">Cliente (opcional)</label>
            <input
              id="cliente"
              value={cliente}
              onChange={(evento) => setCliente(evento.target.value)}
              placeholder="Nome de quem contratou"
              maxLength={120}
            />
          </div>
          <div className="campo">
            <label htmlFor="recebidoEm">Data do recebimento</label>
            <input
              id="recebidoEm"
              type="date"
              value={recebidoEm}
              onChange={(evento) => setRecebidoEm(evento.target.value)}
              required
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="valorRecebido">Valor recebido pelo serviço</label>
          <CampoDinheiro id="valorRecebido" valor={valorRecebido} aoMudar={setValorRecebido} />
        </div>

        <ListaDeCustos
          categorias={categorias}
          linhas={custos}
          aoMudar={setCustos}
          modosPermitidos={MODOS_DE_SERVICO}
          aoCriarCategoria={(categoria) => setCategorias((atuais) => [...atuais, categoria])}
        />

        <div className="campo campo-observacao">
          <label htmlFor="observacao">Observação (opcional)</label>
          <textarea
            id="observacao"
            rows={2}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            placeholder="Endereço, metragem, o que for útil lembrar"
            maxLength={2000}
          />
        </div>

        {erro ? <p className="erro">{erro}</p> : null}

        <div className="acoes-editor">
          <button type="submit" className="botao botao-primario" disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar serviço"}
          </button>
          <Link href="/operacao" className="botao botao-secundario">
            Cancelar
          </Link>
          {editando ? (
            <button type="button" className="botao botao-perigo" onClick={() => void excluir()}>
              Excluir
            </button>
          ) : null}
        </div>
      </div>

      <div className="coluna-resultado">
        <PainelResultado resultado={resultado} />
      </div>
    </form>
  );
}
