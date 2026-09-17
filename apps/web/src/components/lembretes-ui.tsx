/**
 * Pedaços visuais compartilhados entre o formulário e as listas de
 * lembretes. Ficam fora dos dois porque pertencem aos dois — não porque
 * "componentes pequenos vão numa pasta de componentes pequenos".
 */
import type { RecorrenciaProps } from "@advice/domain";
import { descreverRecorrencia } from "@/lib/recorrencia";

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatarQuando(iso: string): string {
  // "qui., 18 de set., 07:00" → "qui, 18 set · 07:00"
  return FORMATO_DATA_HORA.format(new Date(iso))
    .replace(/\./g, "")
    .replace(/,\s(\d{2}:\d{2})$/, " · $1")
    .replace(" de ", " ");
}

export function IconeRepetir() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.5A5.5 5.5 0 0 1 12.8 4M13.5 9.5A5.5 5.5 0 0 1 3.2 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12.5 1.5v3h-3M3.5 14.5v-3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconeLupa() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconeLixeira() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M5.5 4V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 4.5v8.2a1.3 1.3 0 0 0 1.3 1.3h5.4A1.3 1.3 0 0 0 12 12.7V4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M6.6 7v4M9.4 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SeloRepeticao({ recorrencia }: { recorrencia: RecorrenciaProps }) {
  return (
    <p className="selo-repeticao">
      <IconeRepetir />
      {descreverRecorrencia(recorrencia)}
    </p>
  );
}
