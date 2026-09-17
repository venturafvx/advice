import { montarPainelDeHabitos } from "@advice/application";
import { habitoRepository, registroRepository } from "@/lib/container";
import { PainelHabitos } from "@/components/habitos/PainelHabitos";
import { exigirSessao } from "@/lib/auth/sessaoAtual";

export const dynamic = "force-dynamic";

export default async function Habitos() {
  // O proxy.ts já redireciona antes de chegar aqui. Esta checagem é a
  // que realmente autoriza: ela sobrevive a um matcher mal editado.
  await exigirSessao();

  // "Hoje" é decidido aqui, no timezone do app, e desce pronto para a
  // tela. O browser nunca calcula o próprio: um notebook em outro fuso
  // marcaria o tique no dia errado, e o registro do dia certo pareceria
  // não existir.
  const painel = await montarPainelDeHabitos({ habitoRepository, registroRepository });

  return (
    <main>
      <header className="cabecalho">
        <p className="selo">Disciplina · Dia a dia</p>
        <h1>Seus hábitos</h1>
        <p>Marque o que você cumpriu. Quando quebrar, escreva — é o que você vai querer ler depois.</p>
      </header>
      <PainelHabitos painelInicial={painel} />
    </main>
  );
}
