"use client";

import { useState } from "react";
import type { HabitoDto } from "@advice/application";

export interface NotasDaQuebra {
  observacao: string | null;
  pensamento: string | null;
}

/**
 * O momento em que o hábito quebra — a única tela deste app que existe
 * para um estado emocional, não para um dado.
 *
 * Três decisões deliberadas:
 *
 * 1. **A motivação aparece primeiro, antes dos campos.** É o que o
 *    fundador escreveu quando estava inteiro, lido por ele mesmo no
 *    momento em que não está. Se existe uma coisa útil que um app pode
 *    fazer aqui, é essa.
 *
 * 2. **Registrar sem escrever nada é permitido.** Exigir explicação para
 *    admitir uma falha treina a pessoa a não admitir.
 *
 * 3. **Nenhum julgamento no texto.** Sem "você falhou", sem contador
 *    zerado em vermelho piscando. O fato já é duro; a tela não precisa
 *    ajudar.
 */
export function RegistroDeQuebra({
  habito,
  aoRegistrar,
  aoDesistir,
}: {
  habito: HabitoDto;
  /** Devolve a mensagem de erro a exibir, ou `null` se deu certo. */
  aoRegistrar: (notas: NotasDaQuebra) => Promise<string | null>;
  aoDesistir: () => void;
}) {
  const [observacao, setObservacao] = useState("");
  const [pensamento, setPensamento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function registrar(): Promise<void> {
    setErro(null);
    setEnviando(true);
    try {
      const falha = await aoRegistrar({
        observacao: observacao.trim() || null,
        pensamento: pensamento.trim() || null,
      });
      if (falha) setErro(falha);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="registro-quebra">
      <p className="registro-quebra-titulo">{habito.nome}</p>

      {habito.motivacao ? (
        <blockquote className="registro-quebra-motivo">
          <span>Você escreveu:</span>
          {habito.motivacao}
        </blockquote>
      ) : null}

      <div className="campo">
        <label htmlFor={`quebra-o-que-${habito.id}`}>O que aconteceu?</label>
        <textarea
          id={`quebra-o-que-${habito.id}`}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Dormi tarde, acordei atrasado."
          maxLength={2000}
          rows={2}
          autoFocus
        />
      </div>

      <div className="campo">
        <label htmlFor={`quebra-pensamento-${habito.id}`}>O que passou pela sua cabeça agora?</label>
        <textarea
          id={`quebra-pensamento-${habito.id}`}
          value={pensamento}
          onChange={(e) => setPensamento(e.target.value)}
          placeholder="Escreva sem filtrar. É para você ler depois."
          maxLength={2000}
          rows={3}
        />
      </div>

      {erro ? <p className="erro">{erro}</p> : null}

      <div className="acoes-formulario">
        <button type="button" className="botao botao-primario" onClick={() => void registrar()} disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar a quebra"}
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoDesistir} disabled={enviando}>
          Voltar
        </button>
      </div>
    </div>
  );
}
