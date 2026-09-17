import { listarHistorico, listarPendentes } from "@advice/application";
import { lembreteRepository } from "@/lib/container";
import { PainelLembretes } from "@/components/PainelLembretes";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export default async function Home() {
  // O proxy.ts já redireciona antes de chegar aqui. Esta checagem é a
  // que realmente autoriza: ela sobrevive a um matcher mal editado.
  await exigirSessao();

  // Pendentes e histórico vêm de consultas distintas porque crescem de
  // formas distintas: a fila de pendentes tem o tamanho da agenda, o
  // histórico cresce um registro por disparo, para sempre.
  const [pendentes, historico] = await Promise.all([
    listarPendentes({ lembreteRepository }),
    listarHistorico({ lembreteRepository }),
  ]);

  const serializar = (lembretes: Awaited<ReturnType<typeof listarPendentes>>) =>
    lembretes.map((l) => ({ ...l, agendadoPara: l.agendadoPara.toISOString() }));

  return (
    <main>
      <header className="cabecalho">
        <p className="selo">Sophia · WhatsApp</p>
        <h1>Seus lembretes</h1>
        <p>Agende um aviso — uma vez ou toda semana — e receba no WhatsApp na hora certa.</p>
      </header>
      <PainelLembretes
        pendentesIniciais={serializar(pendentes)}
        historicoInicial={serializar(historico)}
      />
    </main>
  );
}
