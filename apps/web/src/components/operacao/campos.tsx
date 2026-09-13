"use client";

import type { ChangeEvent } from "react";
import { PONTOS_BASE_EM_CEM_PORCENTO } from "@advice/domain";
import { formatarDinheiroSimples } from "@/lib/formato";

/**
 * Campos numéricos que guardam **inteiros** (centavos, pontos-base) e
 * exibem o formato brasileiro.
 *
 * O texto digitado nunca é parseado como decimal: só os dígitos contam,
 * e eles entram pela direita — digitar "1", "2", "5", "0" vira 0,01 →
 * 0,12 → 1,25 → 12,50. É como funciona um terminal de cartão, não
 * aceita vírgula ambígua, não tem estado inválido intermediário, e o
 * valor que sai é sempre um inteiro pronto para o domínio.
 */

function somenteDigitos(texto: string, maximoDeDigitos: number): number {
  const digitos = texto.replace(/\D/g, "").slice(0, maximoDeDigitos);
  return digitos.length > 0 ? Number(digitos) : 0;
}

interface CampoDinheiroProps {
  id?: string;
  valor: number;
  aoMudar: (centavos: number) => void;
  "aria-label"?: string;
}

export function CampoDinheiro({ id, valor, aoMudar, ...resto }: CampoDinheiroProps) {
  return (
    <div className="campo-afixo">
      <span className="afixo">R$</span>
      <input
        {...resto}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="alinhado-direita"
        value={formatarDinheiroSimples(valor)}
        onChange={(evento: ChangeEvent<HTMLInputElement>) => aoMudar(somenteDigitos(evento.target.value, 12))}
        onFocus={(evento) => evento.target.select()}
      />
    </div>
  );
}

interface CampoPercentualProps {
  id?: string;
  pontosBase: number;
  aoMudar: (pontosBase: number) => void;
  "aria-label"?: string;
}

export function CampoPercentual({ id, pontosBase, aoMudar, ...resto }: CampoPercentualProps) {
  const texto = (pontosBase / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="campo-afixo afixo-sufixo">
      <input
        {...resto}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="alinhado-direita"
        value={texto}
        onChange={(evento: ChangeEvent<HTMLInputElement>) =>
          aoMudar(Math.min(somenteDigitos(evento.target.value, 6), PONTOS_BASE_EM_CEM_PORCENTO))
        }
        onFocus={(evento) => evento.target.select()}
      />
      <span className="afixo">%</span>
    </div>
  );
}

interface CampoInteiroProps {
  id?: string;
  valor: number;
  aoMudar: (valor: number) => void;
  minimo?: number;
  maximo?: number;
}

export function CampoInteiro({ id, valor, aoMudar, minimo = 1, maximo = 1_000_000 }: CampoInteiroProps) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={minimo}
      max={maximo}
      step={1}
      required
      className="alinhado-direita"
      value={valor === 0 ? "" : valor}
      onChange={(evento) => {
        const numero = Number.parseInt(evento.target.value, 10);
        aoMudar(Number.isNaN(numero) ? 0 : Math.min(Math.max(numero, 0), maximo));
      }}
      onFocus={(evento) => evento.target.select()}
    />
  );
}
