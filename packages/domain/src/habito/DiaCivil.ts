import { DomainError } from "../erros/DomainError";
// Aritmética de calendário é genérica — mora em `lembrete/tempo.ts` por
// antiguidade, não por pertencer àquele contexto. Reusar é o ponto:
// duas implementações de "que dia é hoje em São Paulo" seriam dois
// calendários, e um dia eles discordariam.
import { diaDaSemanaDe, partesEmTimezone, somarDias } from "../lembrete/tempo";

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Segunda-feira. O fundador vive a semana começando na segunda, e a meta semanal é contada assim. */
export const INICIO_DA_SEMANA = 1;

function doisDigitos(valor: number): string {
  return `${valor}`.padStart(2, "0");
}

/**
 * Value object: um dia do calendário — 2026-09-17 — sem hora e sem fuso.
 *
 * É o tipo que sustenta a invariante central dos hábitos: **um registro
 * por hábito por dia**. "Fiz hoje" é uma afirmação sobre o calendário,
 * não sobre um instante; guardar isso como `Date` faria o mesmo registro
 * mudar de dia conforme o fuso de quem lê, e às 21h de São Paulo já
 * cairia no dia seguinte.
 *
 * O fuso aparece uma única vez, em `hoje()`: é ali que um instante
 * absoluto vira um dia do calendário. Depois disso, ninguém mais precisa
 * pensar em timezone.
 */
export class DiaCivil {
  private constructor(
    private readonly ano: number,
    private readonly mes: number,
    private readonly dia: number,
  ) {}

  /** `YYYY-MM-DD`. Recusa data que não existe (2026-02-30), não só formato torto. */
  static de(texto: string): DiaCivil {
    const partes = FORMATO.exec(texto.trim());
    if (!partes) {
      throw new DomainError("Data deve estar no formato AAAA-MM-DD");
    }
    return DiaCivil.dePartes(Number(partes[1]), Number(partes[2]), Number(partes[3]));
  }

  static dePartes(ano: number, mes: number, dia: number): DiaCivil {
    // Round-trip pelo UTC: 2026-02-30 volta como 02 de março, e a
    // divergência denuncia a data inexistente. Validar mês 1–12 e dia
    // 1–31 deixaria fevereiro passar.
    const instante = new Date(Date.UTC(ano, mes - 1, dia));
    if (
      instante.getUTCFullYear() !== ano ||
      instante.getUTCMonth() + 1 !== mes ||
      instante.getUTCDate() !== dia
    ) {
      throw new DomainError(`Data inexistente: ${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`);
    }
    return new DiaCivil(ano, mes, dia);
  }

  /** O único ponto do domínio em que um instante vira um dia. */
  static doInstante(instante: Date, timezone: string): DiaCivil {
    const partes = partesEmTimezone(instante, timezone);
    return new DiaCivil(partes.ano, partes.mes, partes.dia);
  }

  static hoje(timezone: string, agora: Date = new Date()): DiaCivil {
    return DiaCivil.doInstante(agora, timezone);
  }

  /** 0 = domingo … 6 = sábado. Mesma convenção da recorrência dos lembretes. */
  diaDaSemana(): number {
    return diaDaSemanaDe(this.ano, this.mes, this.dia);
  }

  somarDias(dias: number): DiaCivil {
    const { ano, mes, dia } = somarDias({ ano: this.ano, mes: this.mes, dia: this.dia }, dias);
    return new DiaCivil(ano, mes, dia);
  }

  /** A segunda-feira da semana a que este dia pertence. */
  inicioDaSemana(): DiaCivil {
    const deslocamento = (this.diaDaSemana() - INICIO_DA_SEMANA + 7) % 7;
    return this.somarDias(-deslocamento);
  }

  /** Negativo se este dia vem antes de `outro`. */
  comparar(outro: DiaCivil): number {
    return this.toString().localeCompare(outro.toString());
  }

  igual(outro: DiaCivil): boolean {
    return this.comparar(outro) === 0;
  }

  ehAntesDe(outro: DiaCivil): boolean {
    return this.comparar(outro) < 0;
  }

  ehDepoisDe(outro: DiaCivil): boolean {
    return this.comparar(outro) > 0;
  }

  /** Quantos dias de `outro` até este. Positivo se este é o mais recente. */
  diferencaEmDias(outro: DiaCivil): number {
    const umDia = 24 * 60 * 60 * 1000;
    const aqui = Date.UTC(this.ano, this.mes - 1, this.dia);
    const la = Date.UTC(outro.ano, outro.mes - 1, outro.dia);
    return Math.round((aqui - la) / umDia);
  }

  toString(): string {
    return `${this.ano}-${doisDigitos(this.mes)}-${doisDigitos(this.dia)}`;
  }
}
