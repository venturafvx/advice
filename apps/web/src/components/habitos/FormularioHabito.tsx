"use client";

import { useState, type FormEvent } from "react";
import { FrequenciaDoHabito } from "@advice/domain";
import type { CadenciaProps } from "@advice/domain";
import type { HabitoDto } from "@advice/application";
import { DIAS_CURTOS } from "@/lib/recorrencia";
import { descreverCadencia } from "@/lib/cadencia";

const OPCOES: ReadonlyArray<{ valor: FrequenciaDoHabito; rotulo: string }> = [
  { valor: FrequenciaDoHabito.DIARIA, rotulo: "Todo dia" },
  { valor: FrequenciaDoHabito.DIAS_DA_SEMANA, rotulo: "Dias fixos" },
  { valor: FrequenciaDoHabito.VEZES_POR_SEMANA, rotulo: "Vezes na semana" },
];

/** 7× por semana é "todo dia" — a opção não se repete disfarçada de outra coisa. */
const METAS_POSSIVEIS = [1, 2, 3, 4, 5, 6] as const;

export interface ValoresDoHabito {
  nome: string;
  frequencia: FrequenciaDoHabito;
  diasDaSemana: number[];
  vezesPorSemana: number;
  motivacao: string;
}

export const VALORES_VAZIOS: ValoresDoHabito = {
  nome: "",
  frequencia: FrequenciaDoHabito.DIARIA,
  diasDaSemana: [],
  vezesPorSemana: 3,
  motivacao: "",
};

export function valoresDe(habito: HabitoDto): ValoresDoHabito {
  return {
    nome: habito.nome,
    frequencia: habito.cadencia.frequencia,
    diasDaSemana: [...habito.cadencia.diasDaSemana],
    vezesPorSemana: habito.cadencia.vezesPorSemana ?? 3,
    motivacao: habito.motivacao ?? "",
  };
}

/** O corpo que a API espera — união, igual ao schema do servidor. */
export type CorpoDeHabito = {
  nome: string;
  motivacao: string | null;
  cadencia:
    | { frequencia: "DIARIA" }
    | { frequencia: "DIAS_DA_SEMANA"; diasDaSemana: number[] }
    | { frequencia: "VEZES_POR_SEMANA"; vezesPorSemana: number };
};

/**
 * O formulário de um hábito — o mesmo para criar e para editar.
 *
 * Um componente só pela mesma razão do formulário de lembrete: a decisão
 * que ele carrega ("o que, com que frequência, e por quê") é idêntica
 * nos dois casos. Duas cópias divergiriam, e a divergência apareceria
 * como um hábito cobrando dias que ninguém escolheu.
 */
export function FormularioHabito({
  valoresIniciais = VALORES_VAZIOS,
  modo = "criar",
  aoSubmeter,
  aoDesistir,
}: {
  valoresIniciais?: ValoresDoHabito;
  modo?: "criar" | "editar";
  /** Devolve a mensagem de erro a exibir, ou `null` se deu certo. */
  aoSubmeter: (corpo: CorpoDeHabito) => Promise<string | null>;
  aoDesistir?: () => void;
}) {
  const [nome, setNome] = useState(valoresIniciais.nome);
  const [frequencia, setFrequencia] = useState(valoresIniciais.frequencia);
  const [diasDaSemana, setDiasDaSemana] = useState<number[]>(valoresIniciais.diasDaSemana);
  const [vezesPorSemana, setVezesPorSemana] = useState(valoresIniciais.vezesPorSemana);
  const [motivacao, setMotivacao] = useState(valoresIniciais.motivacao);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const idBase = modo === "criar" ? "novo-habito" : "editar-habito";

  // A prévia sai da mesma função que descreve a cadência na lista: o que
  // o formulário promete é, literalmente, o que a lista vai dizer.
  const previaDaCadencia: CadenciaProps | null =
    frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA && diasDaSemana.length === 0
      ? null
      : {
          frequencia,
          diasDaSemana: frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA ? diasDaSemana : [],
          vezesPorSemana: frequencia === FrequenciaDoHabito.VEZES_POR_SEMANA ? vezesPorSemana : null,
        };

  function alternarDia(dia: number): void {
    setDiasDaSemana((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort((a, b) => a - b),
    );
  }

  function corpoDaRequisicao(): { corpo: CorpoDeHabito } | { erro: string } {
    if (!nome.trim()) return { erro: "Dê um nome ao hábito" };

    const motivacaoLimpa = motivacao.trim() || null;

    if (frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA) {
      if (diasDaSemana.length === 0) return { erro: "Escolha pelo menos um dia da semana" };
      return {
        corpo: {
          nome: nome.trim(),
          motivacao: motivacaoLimpa,
          cadencia: { frequencia: "DIAS_DA_SEMANA", diasDaSemana },
        },
      };
    }

    if (frequencia === FrequenciaDoHabito.VEZES_POR_SEMANA) {
      return {
        corpo: {
          nome: nome.trim(),
          motivacao: motivacaoLimpa,
          cadencia: { frequencia: "VEZES_POR_SEMANA", vezesPorSemana },
        },
      };
    }

    return { corpo: { nome: nome.trim(), motivacao: motivacaoLimpa, cadencia: { frequencia: "DIARIA" } } };
  }

  async function submeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);

    const requisicao = corpoDaRequisicao();
    if ("erro" in requisicao) {
      setErro(requisicao.erro);
      return;
    }

    setEnviando(true);
    try {
      const falha = await aoSubmeter(requisicao.corpo);
      if (falha) {
        setErro(falha);
        return;
      }
      if (modo === "criar") {
        setNome("");
        setMotivacao("");
        setDiasDaSemana([]);
        setFrequencia(FrequenciaDoHabito.DIARIA);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={submeter}>
      <div className="campo">
        <label htmlFor={`${idBase}-nome`}>Qual hábito você quer manter?</label>
        <input
          id={`${idBase}-nome`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Academia"
          maxLength={60}
          autoFocus={modo === "editar"}
          required
        />
      </div>

      <div className="campo">
        <span className="rotulo" id={`${idBase}-rotulo-frequencia`}>
          Com que frequência
        </span>
        <div className="segmentado de-habito" role="group" aria-labelledby={`${idBase}-rotulo-frequencia`}>
          {OPCOES.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={frequencia === opcao.valor}
              onClick={() => {
                setFrequencia(opcao.valor);
                setErro(null);
              }}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      </div>

      {frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA ? (
        <div className="campo">
          <span className="rotulo" id={`${idBase}-rotulo-dias`}>
            Em quais dias
          </span>
          <div className="dias-semana" role="group" aria-labelledby={`${idBase}-rotulo-dias`}>
            {DIAS_CURTOS.map((rotulo, indice) => (
              <button
                key={rotulo}
                type="button"
                aria-pressed={diasDaSemana.includes(indice)}
                onClick={() => alternarDia(indice)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {frequencia === FrequenciaDoHabito.VEZES_POR_SEMANA ? (
        <div className="campo">
          <span className="rotulo" id={`${idBase}-rotulo-meta`}>
            Quantas vezes por semana
          </span>
          <div className="segmentado de-habito compacto" role="group" aria-labelledby={`${idBase}-rotulo-meta`}>
            {METAS_POSSIVEIS.map((meta) => (
              <button
                key={meta}
                type="button"
                aria-pressed={vezesPorSemana === meta}
                onClick={() => setVezesPorSemana(meta)}
              >
                {meta}×
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="campo">
        <label htmlFor={`${idBase}-motivacao`}>Por que isso importa (opcional)</label>
        <textarea
          id={`${idBase}-motivacao`}
          value={motivacao}
          onChange={(e) => setMotivacao(e.target.value)}
          placeholder="Você vai ler isto no dia em que quiser desistir."
          maxLength={500}
          rows={2}
        />
      </div>

      {previaDaCadencia ? <p className="previsao-habito">{descreverCadencia(previaDaCadencia)}</p> : null}

      {erro ? <p className="erro">{erro}</p> : null}

      {modo === "criar" ? (
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? "Criando…" : "Criar hábito"}
        </button>
      ) : (
        <div className="acoes-formulario">
          <button type="submit" className="botao botao-primario" disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar alterações"}
          </button>
          <button type="button" className="botao botao-secundario" onClick={aoDesistir} disabled={enviando}>
            Descartar
          </button>
        </div>
      )}
    </form>
  );
}
