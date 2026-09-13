import Link from "next/link";
import type { CompraDto, ResumoDaOperacao, ServicoDto } from "@advice/application";
import { faixaDeMargem, formatarData, formatarDinheiro, formatarFracao } from "@/lib/formato";
import { PERIODOS, type ChaveDePeriodo } from "@/lib/periodo";

interface Props {
  resumo: ResumoDaOperacao;
  periodo: ChaveDePeriodo;
}

/**
 * Painel de leitura, 100% renderizado no servidor — nenhuma linha de
 * JavaScript vai para o browser aqui. Os números já saem calculados do
 * domínio e os filtros são links, não estado de cliente.
 */
export function PainelOperacao({ resumo, periodo }: Props) {
  const { consolidado, mercadoria, servicos } = resumo;

  return (
    <>
      <nav className="filtro-periodo" aria-label="Período">
        {PERIODOS.map(({ chave, rotulo }) => (
          <Link key={chave} href={`/operacao?periodo=${chave}`} className={chave === periodo ? "ativo" : ""}>
            {rotulo}
          </Link>
        ))}
      </nav>

      <div className="kpis">
        <Kpi rotulo="Receita" valor={formatarDinheiro(consolidado.receitaBrutaCentavos)} />
        <Kpi rotulo="Custo total" valor={formatarDinheiro(consolidado.custoTotalCentavos)} />
        <Kpi
          rotulo="Lucro líquido"
          valor={formatarDinheiro(consolidado.lucroLiquidoCentavos)}
          destaque={consolidado.lucroLiquidoCentavos < 0 ? "negativo" : "positivo"}
        />
        <Kpi
          rotulo="Margem líquida"
          valor={formatarFracao(consolidado.margemLiquida)}
          faixa={consolidado.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(consolidado.margemLiquida)}
        />
      </div>

      <p className="aviso-projecao">
        Mercadoria entra como <strong>projeção</strong> — é o resultado se o lote vender ao preço planejado.
        Serviço entra como <strong>realizado</strong>: o dinheiro já entrou.
      </p>

      <div className="duas-colunas">
        <BlocoDeLinha
          titulo="Mercadoria"
          selo="projetado"
          linha={mercadoria}
          rodape={`${resumo.unidadesEmEstoque.toLocaleString("pt-BR")} un. · ${formatarDinheiro(resumo.capitalEmMercadoriaCentavos)} investidos`}
        />
        <BlocoDeLinha
          titulo="Serviços"
          selo="realizado"
          linha={servicos}
          rodape={`${servicos.operacoes} serviço(s)`}
        />
      </div>

      {resumo.custosPorCategoria.length > 0 ? (
        <section>
          <p className="secao-titulo">Para onde o custo vai</p>
          <div className="cartao">
            {resumo.custosPorCategoria.map((custo) => (
              <div className="barra-categoria" key={custo.rotulo}>
                <div className="barra-categoria-topo">
                  <span>{custo.rotulo}</span>
                  <span className="num">{formatarDinheiro(custo.totalCentavos)}</span>
                </div>
                <div className="trilho">
                  <span style={{ width: `${custo.fatiaDosCustos * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="secao-cabecalho">
          <p className="secao-titulo">Compras</p>
          <Link href="/operacao/compras/nova" className="botao botao-secundario">
            + Compra
          </Link>
        </div>
        <div className="cartao">
          {resumo.compras.length === 0 ? (
            <p className="lista-vazia">Nenhuma compra neste período.</p>
          ) : (
            <div className="rolagem-horizontal">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Mercadoria</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Investido</th>
                    <th className="num">Receita</th>
                    <th className="num">Lucro</th>
                    <th className="num">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.compras.map((compra) => (
                    <LinhaDeCompra key={compra.id} compra={compra} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="secao-cabecalho">
          <p className="secao-titulo">Serviços</p>
          <Link href="/operacao/servicos/novo" className="botao botao-secundario">
            + Serviço
          </Link>
        </div>
        <div className="cartao">
          {resumo.servicosRegistrados.length === 0 ? (
            <p className="lista-vazia">Nenhum serviço neste período.</p>
          ) : (
            <div className="rolagem-horizontal">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th className="num">Recebido</th>
                    <th className="num">Custos</th>
                    <th className="num">Lucro</th>
                    <th className="num">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.servicosRegistrados.map((servico) => (
                    <LinhaDeServico key={servico.id} servico={servico} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function LinhaDeCompra({ compra }: { compra: CompraDto }) {
  const r = compra.resultado;
  const faixa = r.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(r.margemLiquida);

  return (
    <tr>
      <td>
        <Link href={`/operacao/compras/${compra.id}`} className="celula-principal">
          <span className="titulo">{compra.descricao}</span>
          <span className="sublinha">{formatarData(compra.compradoEm)}</span>
        </Link>
      </td>
      <td className="num">{compra.quantidade.toLocaleString("pt-BR")}</td>
      <td className="num">{formatarDinheiro(r.custoTotalCentavos)}</td>
      <td className="num">{formatarDinheiro(r.receitaBrutaCentavos)}</td>
      <td className={`num ${r.lucroLiquidoCentavos < 0 ? "negativo" : ""}`}>
        {formatarDinheiro(r.lucroLiquidoCentavos)}
      </td>
      <td className="num">
        <span className={`chip ${faixa}`}>{formatarFracao(r.margemLiquida)}</span>
      </td>
    </tr>
  );
}

function LinhaDeServico({ servico }: { servico: ServicoDto }) {
  const r = servico.resultado;
  const faixa = r.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(r.margemLiquida);

  return (
    <tr>
      <td>
        <Link href={`/operacao/servicos/${servico.id}`} className="celula-principal">
          <span className="titulo">{servico.descricao}</span>
          <span className="sublinha">
            {formatarData(servico.recebidoEm)}
            {servico.cliente ? ` · ${servico.cliente}` : ""}
          </span>
        </Link>
      </td>
      <td className="num">{formatarDinheiro(r.receitaBrutaCentavos)}</td>
      <td className="num">{formatarDinheiro(r.custosOperacionaisCentavos)}</td>
      <td className={`num ${r.lucroLiquidoCentavos < 0 ? "negativo" : ""}`}>
        {formatarDinheiro(r.lucroLiquidoCentavos)}
      </td>
      <td className="num">
        <span className={`chip ${faixa}`}>{formatarFracao(r.margemLiquida)}</span>
      </td>
    </tr>
  );
}

function Kpi({
  rotulo,
  valor,
  destaque,
  faixa,
}: {
  rotulo: string;
  valor: string;
  destaque?: "positivo" | "negativo";
  faixa?: string;
}) {
  return (
    <div className="kpi">
      <span className="rotulo">{rotulo}</span>
      <span className={`valor num ${destaque ?? ""} ${faixa ? `tom-${faixa}` : ""}`}>{valor}</span>
    </div>
  );
}

function BlocoDeLinha({
  titulo,
  selo,
  linha,
  rodape,
}: {
  titulo: string;
  selo: string;
  linha: {
    receitaBrutaCentavos: number;
    custoTotalCentavos: number;
    lucroLiquidoCentavos: number;
    margemLiquida: number | null;
  };
  rodape: string;
}) {
  const faixa = linha.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(linha.margemLiquida);

  return (
    <div className="cartao bloco-linha">
      <div className="bloco-linha-cabecalho">
        <h2>{titulo}</h2>
        <span className="selo-discreto">{selo}</span>
      </div>
      <dl className="resultado-linhas compacto">
        <div className="resultado-linha">
          <dt>Receita</dt>
          <dd className="num">{formatarDinheiro(linha.receitaBrutaCentavos)}</dd>
        </div>
        <div className="resultado-linha">
          <dt>Custo total</dt>
          <dd className="num">− {formatarDinheiro(linha.custoTotalCentavos)}</dd>
        </div>
        <div className="resultado-linha forte">
          <dt>Lucro líquido</dt>
          <dd className={`num ${linha.lucroLiquidoCentavos < 0 ? "negativo" : ""}`}>
            {formatarDinheiro(linha.lucroLiquidoCentavos)}
          </dd>
        </div>
      </dl>
      <div className="bloco-linha-rodape">
        <span className={`chip ${faixa}`}>{formatarFracao(linha.margemLiquida)}</span>
        <span className="sublinha">{rodape}</span>
      </div>
    </div>
  );
}
