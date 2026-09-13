import { listarLembretes } from "@advice/application";
import { lembreteRepository } from "@/lib/container";
import { PainelLembretes } from "@/components/PainelLembretes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const lembretes = await listarLembretes({ lembreteRepository });
  const lembretesSerializados = lembretes.map((l) => ({ ...l, agendadoPara: l.agendadoPara.toISOString() }));

  return (
    <main>
      <header className="cabecalho">
        <p className="selo">Sophia · WhatsApp</p>
        <h1>Seus lembretes</h1>
        <p>Agende um aviso e receba no WhatsApp na hora certa.</p>
      </header>
      <PainelLembretes lembretesIniciais={lembretesSerializados} />
    </main>
  );
}
