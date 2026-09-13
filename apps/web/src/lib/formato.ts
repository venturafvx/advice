import { PONTOS_BASE_EM_CEM_PORCENTO } from "@advice/domain";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MOEDA_SEM_SIMBOLO = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function formatarDinheiro(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/** Sem o "R$" — para dentro de campos e colunas que já têm o contexto. */
export function formatarDinheiroSimples(centavos: number): string {
  return MOEDA_SEM_SIMBOLO.format(centavos / 100);
}

export function formatarPontosBase(pontosBase: number): string {
  const porcento = pontosBase / (PONTOS_BASE_EM_CEM_PORCENTO / 100);
  return `${porcento.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Fração 0–1 vinda do cálculo de margem. `null` vira travessão. */
export function formatarFracao(fracao: number | null): string {
  if (fracao === null || !Number.isFinite(fracao)) {
    return "—";
  }
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function formatarData(iso: string): string {
  return DATA_CURTA.format(new Date(iso));
}

/**
 * ISO completo → `YYYY-MM-DD` na data **local**, que é o que um
 * `<input type="date">` espera.
 *
 * `toISOString().slice(0, 10)` seria o atalho óbvio e estaria errado:
 * ele devolve a data em UTC, e às 21h de São Paulo isso já é o dia
 * seguinte — a data da compra apareceria um dia à frente no formulário.
 */
export function paraValorDeCampoData(iso: string): string {
  const data = new Date(iso);
  const mes = `${data.getMonth() + 1}`.padStart(2, "0");
  const dia = `${data.getDate()}`.padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function hojeComoValorDeCampoData(): string {
  return paraValorDeCampoData(new Date().toISOString());
}

/** Classe de cor por faixa de margem — verde / âmbar / vermelho. */
export function faixaDeMargem(fracao: number | null): "bom" | "medio" | "ruim" | "neutro" {
  if (fracao === null || !Number.isFinite(fracao)) {
    return "neutro";
  }
  if (fracao >= 0.3) {
    return "bom";
  }
  if (fracao >= 0.1) {
    return "medio";
  }
  return "ruim";
}
