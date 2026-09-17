"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Frequencia } from "@advice/domain";
import type { RecorrenciaProps } from "@advice/domain";
import { DIAS_CURTOS, descreverRecorrencia, proximaOcorrenciaPrevista } from "@/lib/recorrencia";
import { IconeRepetir, formatarQuando } from "@/components/lembretes-ui";

/** "Uma vez" não é uma frequência do domínio — é a ausência de uma. */
export const AVULSO = "AVULSO" as const;
export type Repeticao = typeof AVULSO | Frequencia;

const REPETICOES: ReadonlyArray<{ valor: Repeticao; rotulo: string }> = [
  { valor: AVULSO, rotulo: "Uma vez" },
  { valor: Frequencia.DIARIA, rotulo: "Todo dia" },
  { valor: Frequencia.SEMANAL, rotulo: "Toda semana" },
  { valor: Frequencia.MENSAL, rotulo: "Todo mês" },
];

export interface ValoresDoLembrete {
  titulo: string;
  repeticao: Repeticao;
  /** `YYYY-MM-DD`, só para a repetição "uma vez". */
  dia: string;
  /** `HH:MM`. */
  hora: string;
  diasDaSemana: number[];
  /** String porque vem de um `<input type="number">`. */
  diaDoMes: string;
}

export const VALORES_VAZIOS: ValoresDoLembrete = {
  titulo: "",
  repeticao: AVULSO,
  dia: "",
  hora: "",
  diasDaSemana: [],
  diaDoMes: "1",
};

function doisDigitos(valor: number): string {
  return `${valor}`.padStart(2, "0");
}

/**
 * Preenche o formulário a partir de um lembrete existente.
 *
 * As partes de data saem dos getters locais do `Date`, e não de
 * `toISOString()`, pelo mesmo motivo que a criação envia
 * `"2026-09-18T07:00"` sem fuso: o campo do formulário é relógio de
 * parede. Converter para UTC no caminho de volta mostraria 04:00 para um
 * lembrete das 07:00.
 */
export function valoresDe(lembrete: {
  titulo: string;
  agendadoPara: string;
  recorrencia: RecorrenciaProps | null;
}): ValoresDoLembrete {
  const quando = new Date(lembrete.agendadoPara);
  const { recorrencia } = lembrete;

  return {
    titulo: lembrete.titulo,
    repeticao: recorrencia?.frequencia ?? AVULSO,
    dia: recorrencia
      ? ""
      : `${quando.getFullYear()}-${doisDigitos(quando.getMonth() + 1)}-${doisDigitos(quando.getDate())}`,
    hora: recorrencia
      ? `${doisDigitos(recorrencia.hora)}:${doisDigitos(recorrencia.minuto)}`
      : `${doisDigitos(quando.getHours())}:${doisDigitos(quando.getMinutes())}`,
    diasDaSemana: [...(recorrencia?.diasDaSemana ?? [])],
    diaDoMes: `${recorrencia?.diaDoMes ?? 1}`,
  };
}

export type CorpoDeLembrete =
  { titulo: string; agendadoPara: string } | { titulo: string; recorrencia: RecorrenciaProps };

/**
 * O formulário de um lembrete — o mesmo para criar e para editar.
 *
 * Um componente só, e não dois parecidos, porque a decisão que ele
 * carrega é idêntica nos dois casos ("uma vez ou repetindo, e quando").
 * Duas cópias divergiriam, e a divergência apareceria como um lembrete
 * agendado numa hora que ninguém pediu.
 */
export function FormularioLembrete({
  valoresIniciais = VALORES_VAZIOS,
  modo = "criar",
  aoSubmeter,
  aoDesistir,
}: {
  valoresIniciais?: ValoresDoLembrete;
  modo?: "criar" | "editar";
  /** Devolve a mensagem de erro a exibir, ou `null` se deu certo. */
  aoSubmeter: (corpo: CorpoDeLembrete) => Promise<string | null>;
  aoDesistir?: () => void;
}) {
  const [titulo, setTitulo] = useState(valoresIniciais.titulo);
  const [repeticao, setRepeticao] = useState<Repeticao>(valoresIniciais.repeticao);
  const [dia, setDia] = useState(valoresIniciais.dia);
  const [hora, setHora] = useState(valoresIniciais.hora);
  const [diasDaSemana, setDiasDaSemana] = useState<number[]>(valoresIniciais.diasDaSemana);
  const [diaDoMes, setDiaDoMes] = useState(valoresIniciais.diaDoMes);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const idBase = modo === "criar" ? "novo" : "editar";

  const recorrencia = useMemo<RecorrenciaProps | null>(() => {
    if (repeticao === AVULSO || !hora) return null;

    const [h, m] = hora.split(":");
    return {
      frequencia: repeticao,
      hora: Number(h),
      minuto: Number(m),
      diasDaSemana: repeticao === Frequencia.SEMANAL ? diasDaSemana : [],
      diaDoMes: repeticao === Frequencia.MENSAL ? Number(diaDoMes) : null,
    };
  }, [repeticao, hora, diasDaSemana, diaDoMes]);

  // Recalculada a cada tecla, pelo mesmo código do servidor: a prévia é
  // a promessa, não uma aproximação dela.
  const previsao = useMemo(
    () => (recorrencia ? proximaOcorrenciaPrevista(recorrencia) : null),
    [recorrencia],
  );

  function alternarDia(dia: number): void {
    setDiasDaSemana((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort(),
    );
  }

  function trocarRepeticao(nova: Repeticao): void {
    setRepeticao(nova);
    setErro(null);
    // Ao passar a repetir, o dia solto do calendário deixa de fazer
    // sentido — a regra é quem manda na data a partir daqui.
    if (nova !== AVULSO) setDia("");
  }

  function corpoDaRequisicao(): { corpo: CorpoDeLembrete } | { erro: string } {
    if (!titulo.trim()) return { erro: "Informe o que você quer lembrar" };

    if (repeticao === AVULSO) {
      if (!dia || !hora) return { erro: "Escolha o dia e a hora do lembrete" };
      return { corpo: { titulo, agendadoPara: `${dia}T${hora}` } };
    }

    if (!hora) return { erro: "Escolha o horário do lembrete" };
    if (repeticao === Frequencia.SEMANAL && diasDaSemana.length === 0) {
      return { erro: "Escolha pelo menos um dia da semana" };
    }
    if (!recorrencia) return { erro: "Repetição incompleta" };

    return { corpo: { titulo, recorrencia } };
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
        setTitulo("");
        setDia("");
        setHora("");
        setDiasDaSemana([]);
        setRepeticao(AVULSO);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={submeter}>
      <div className="campo">
        <label htmlFor={`${idBase}-titulo`}>O que você quer lembrar?</label>
        <input
          id={`${idBase}-titulo`}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Pagar o fornecedor X"
          maxLength={200}
          autoFocus={modo === "editar"}
          required
        />
      </div>

      <div className="campo">
        <span className="rotulo" id={`${idBase}-rotulo-repeticao`}>
          Repetir
        </span>
        <div className="segmentado" role="group" aria-labelledby={`${idBase}-rotulo-repeticao`}>
          {REPETICOES.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={repeticao === opcao.valor}
              onClick={() => trocarRepeticao(opcao.valor)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      </div>

      {repeticao === Frequencia.SEMANAL ? (
        <div className="campo">
          <span className="rotulo" id={`${idBase}-rotulo-dias`}>
            Em quais dias
          </span>
          <div className="dias-semana" role="group" aria-labelledby={`${idBase}-rotulo-dias`}>
            {DIAS_CURTOS.map((nome, indice) => (
              <button
                key={nome}
                type="button"
                aria-pressed={diasDaSemana.includes(indice)}
                onClick={() => alternarDia(indice)}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="linha">
        {repeticao === AVULSO ? (
          <div className="campo">
            <label htmlFor={`${idBase}-dia`}>Dia</label>
            <input
              id={`${idBase}-dia`}
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              required
            />
          </div>
        ) : null}

        {repeticao === Frequencia.MENSAL ? (
          <div className="campo">
            <label htmlFor={`${idBase}-dia-do-mes`}>Dia do mês</label>
            <input
              id={`${idBase}-dia-do-mes`}
              type="number"
              min={1}
              max={31}
              value={diaDoMes}
              onChange={(e) => setDiaDoMes(e.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="campo">
          <label htmlFor={`${idBase}-hora`}>Hora</label>
          <input
            id={`${idBase}-hora`}
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
        </div>
      </div>

      {previsao ? (
        <p className="previsao">
          <IconeRepetir />
          <span>
            {recorrencia ? descreverRecorrencia(recorrencia) : null} ·{" "}
            {modo === "criar" ? "primeiro envio" : "próximo envio"}{" "}
            <strong>{formatarQuando(previsao.toISOString())}</strong>
          </span>
        </p>
      ) : null}

      {erro ? <p className="erro">{erro}</p> : null}

      {modo === "criar" ? (
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? "Agendando…" : repeticao === AVULSO ? "Agendar lembrete" : "Agendar repetição"}
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
