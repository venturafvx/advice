/**
 * Pedaços visuais compartilhados pela tela de hábitos. Ficam fora do
 * painel e do formulário porque pertencem aos dois.
 */
import { SituacaoDoDia } from "@advice/domain";
import type { DiaDaSemanaDto, HabitoDto } from "@advice/application";
import { DIAS_CURTOS } from "@/lib/recorrencia";

const FORMATO_DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const FORMATO_DIA_COM_SEMANA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

/**
 * `YYYY-MM-DD` → `Date` no fuso **local**, nunca `new Date("2026-09-17")`.
 *
 * Aquela forma é interpretada como meia-noite UTC, que em São Paulo é
 * 21h do dia anterior — e a faixa da semana mostraria todo dia deslocado
 * em um. O dia civil só existe para ser formatado aqui; nenhuma conta
 * depende deste `Date`.
 */
function comoDataLocal(dia: string): Date {
  const [ano, mes, data] = dia.split("-").map(Number);
  return new Date(ano as number, (mes as number) - 1, data as number);
}

/**
 * "17 set" — sem o "de" e sem os pontos que o pt-BR põe nas abreviações.
 * Mesma limpeza de `formatarQuando` nos lembretes: a data aparece em
 * linha com outras informações, e "17 de set." vira ruído ali.
 */
function limpar(texto: string): string {
  return texto.replace(/\./g, "").replace(" de ", " ");
}

/** "17 set" */
export function formatarDiaCurto(dia: string): string {
  return limpar(FORMATO_DIA.format(comoDataLocal(dia)));
}

/** "qui, 17 set" */
export function formatarDiaComSemana(dia: string): string {
  return limpar(FORMATO_DIA_COM_SEMANA.format(comoDataLocal(dia)));
}

type EstadoDoDia = "feito" | "quebrado" | "falta" | "livre" | "futuro";

function estadoDoDia(dia: DiaDaSemanaDto): EstadoDoDia {
  if (dia.situacao === SituacaoDoDia.FEITO) return "feito";
  if (dia.situacao === SituacaoDoDia.QUEBRADO) return "quebrado";
  // Futuro antes de falta: quarta em branco numa segunda não é falha
  // nenhuma, e pintá-la igual a uma quarta passada seria acusar sem fato.
  if (dia.futuro) return "futuro";
  return dia.exigido ? "falta" : "livre";
}

const DESCRICAO: Record<EstadoDoDia, string> = {
  feito: "cumprido",
  quebrado: "quebrado",
  falta: "sem registro",
  livre: "dia livre",
  futuro: "ainda não chegou",
};

/**
 * A semana em sete quadrados — a leitura que responde "como eu estou?"
 * antes de qualquer número.
 *
 * Começa na segunda porque é assim que a semana é vivida aqui, e é a
 * mesma convenção em que a meta semanal é contada. Mostrar de domingo a
 * sábado enquanto a meta fecha de segunda a domingo faria os dois
 * discordarem na tela.
 */
export function FaixaDaSemana({ semana, hoje }: { semana: DiaDaSemanaDto[]; hoje: string }) {
  return (
    <div className="faixa-semana" role="list" aria-label="Esta semana">
      {semana.map((dia) => {
        const estado = estadoDoDia(dia);
        const inicial = DIAS_CURTOS[comoDataLocal(dia.dia).getDay()] as string;
        return (
          <span
            key={dia.dia}
            role="listitem"
            className="dia-semana"
            data-estado={estado}
            data-hoje={dia.dia === hoje ? "sim" : undefined}
            title={`${formatarDiaComSemana(dia.dia)} — ${DESCRICAO[estado]}`}
            aria-label={`${formatarDiaComSemana(dia.dia)}, ${DESCRICAO[estado]}`}
          >
            <span aria-hidden="true">{inicial.charAt(0).toUpperCase()}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Um hábito flexível conta semana; os outros contam dia. O ícone é o mesmo, o rótulo não. */
export function SeloDeSequencia({ habito }: { habito: HabitoDto }) {
  const { sequencia } = habito.desempenho;
  if (sequencia === 0) return null;

  return (
    <span className="selo-sequencia" title="Dias seguidos cumpridos e declarados">
      <IconeChama />
      {sequencia}
    </span>
  );
}

export function IconeChama() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5s.9 2.2-.6 3.9C6 7 4 8 4 10.2A4 4 0 0 0 12 10.4c0-1.6-.9-2.6-1.6-3.4-.5.6-1 .8-1.4.6.7-1.6.6-4.2-1-6.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconeCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeQuebra() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconeArquivar() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.2 6.5v6a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1v-6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
