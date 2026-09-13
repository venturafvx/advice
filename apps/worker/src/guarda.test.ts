import { describe, expect, it } from "vitest";
import { hostDoBanco, podeAgendarEnvios } from "./guarda";

const POOLER = "postgresql://postgres.abc:senha@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";
const LOCAL = "postgresql://advice:senha@localhost:5432/advice";

describe("podeAgendarEnvios", () => {
  it("libera contra o Postgres local sem precisar de flag", () => {
    expect(podeAgendarEnvios(LOCAL, undefined)).toBe(true);
    expect(podeAgendarEnvios("postgresql://a:b@127.0.0.1:5432/d", undefined)).toBe(true);
    expect(podeAgendarEnvios("postgresql://a:b@[::1]:5432/d", undefined)).toBe(true);
  });

  it("libera contra os nomes de serviço do Compose e do Swarm", () => {
    expect(podeAgendarEnvios("postgresql://a:b@postgres:5432/d", undefined)).toBe(true);
    expect(podeAgendarEnvios("postgresql://a:b@advice_postgres:5432/d", undefined)).toBe(true);
  });

  it("bloqueia host remoto sem WORKER_PRIMARY — o caso do scheduler duplicado", () => {
    expect(podeAgendarEnvios(POOLER, undefined)).toBe(false);
    expect(podeAgendarEnvios("postgresql://a:b@db.abc.supabase.co:5432/postgres", undefined)).toBe(false);
  });

  it("libera host remoto quando o processo se declara primário", () => {
    expect(podeAgendarEnvios(POOLER, "true")).toBe(true);
  });

  it("exige exatamente \"true\" — evita que um valor qualquer vire liberação", () => {
    for (const valor of ["TRUE", "True", "1", "yes", "sim", "", " true"]) {
      expect(podeAgendarEnvios(POOLER, valor)).toBe(false);
    }
  });

  it("não opina quando a URL falta ou não parseia — isso é problema do Zod", () => {
    expect(podeAgendarEnvios(undefined, undefined)).toBe(true);
    expect(podeAgendarEnvios("nao-e-uma-url", undefined)).toBe(true);
  });
});

describe("hostDoBanco", () => {
  it("tira os colchetes de IPv6", () => {
    expect(hostDoBanco("postgresql://a:b@[2600:1f11::1]:5432/d")).toBe("2600:1f11::1");
  });

  it("devolve undefined para string sem forma de URL", () => {
    expect(hostDoBanco("")).toBeUndefined();
  });
});
