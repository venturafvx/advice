import Link from "next/link";
import type { ResumoDaOperacao } from "@advice/application";
import type { Negocio } from "@advice/domain";
import { caminhoDoNegocio, PERFIS_LISTA } from "@/lib/negocios";
import { faixaDeMargem, formatarDinheiro, formatarFracao } from "@/lib/formato";
import { FiltroDePeriodo } from "./FiltroDePeriodo";
import type { ChaveDePeriodo } from "@/lib/periodo";

/**
 * Os dois negócios, um cartão cada, sem nenhuma linha de total.
 *
 * A ausência do total é a decisão: somar a receita projetada de um lote
 * de marketplace com o recebido de uma aplicação de papel de parede dá
 * um número que não é caixa nem projeção de ninguém. Quem quiser
 * comparar, compara os dois cartões.
 */
export function VisaoGeral({
  resumos,
  periodo,
}: {
  resumos: Record<Negocio, ResumoDaOperacao>;
  periodo: ChaveDePeriodo;
}) {
  return (
    <>
      <FiltroDePeriodo base="/operacao" periodo={periodo} />

      <div className="duas-colunas">
        {PERFIS_LISTA.map((perfil) => {
          const resumo = resumos[perfil.negocio];
          const { consolidado } = resumo;
          const faixa =
            consolidado.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(consolidado.margemLiquida);
          const base = caminhoDoNegocio(perfil);
          const lancamentos = consolidado.operacoes;

          return (
            <Link key={perfil.slug} href={`${base}?periodo=${periodo}`} className="cartao cartao-negocio">
              <div className="cartao-negocio-topo">
                <div>
                  <h2>{perfil.nome}</h2>
                  <p className="sublinha">{perfil.atividade}</p>
                </div>
                <span className={`chip ${faixa}`}>{formatarFracao(consolidado.margemLiquida)}</span>
              </div>

              {lancamentos === 0 ? (
                <p className="lista-vazia">Nada registrado neste período.</p>
              ) : (
                <dl className="resultado-linhas compacto">
                  <div className="resultado-linha">
                    <dt>Receita</dt>
                    <dd className="num">{formatarDinheiro(consolidado.receitaBrutaCentavos)}</dd>
                  </div>
                  <div className="resultado-linha">
                    <dt>Custo total</dt>
                    <dd className="num">− {formatarDinheiro(consolidado.custoTotalCentavos)}</dd>
                  </div>
                  <div className="resultado-linha forte">
                    <dt>Lucro líquido</dt>
                    <dd className={`num ${consolidado.lucroLiquidoCentavos < 0 ? "negativo" : ""}`}>
                      {formatarDinheiro(consolidado.lucroLiquidoCentavos)}
                    </dd>
                  </div>
                </dl>
              )}

              <div className="cartao-negocio-rodape">
                <span className="sublinha">
                  {resumo.compras.length} compra(s)
                  {perfil.temServicos || resumo.servicosRegistrados.length > 0
                    ? ` · ${resumo.servicosRegistrados.length} serviço(s)`
                    : ""}
                </span>
                <span className="seta" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="aviso-projecao">
        Cada negócio aparece sozinho, de propósito: <strong>não há linha de total</strong>. Mercadoria é
        receita <strong>projetada</strong> e serviço é <strong>realizada</strong> — somar as duas
        operações produziria um número que não descreve nenhuma delas.
      </p>
    </>
  );
}
