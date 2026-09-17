import Link from "next/link";
import type { CompraDto, ResumoDaOperacao, ServicoDto } from "@advice/application";
import { faixaDeMargem, formatarData, formatarDinheiro, formatarFracao } from "@/lib/formato";
import { caminhoDoNegocio, type PerfilDeNegocio } from "@/lib/negocios";
import type { ChaveDePeriodo } from "@/lib/periodo";
import { AcoesDaLinha } from "./AcoesDaLinha";
import { FiltroDePeriodo } from "./FiltroDePeriodo";

interface Props {
  resumo: ResumoDaOperacao;
  periodo: ChaveDePeriodo;
  perfil: PerfilDeNegocio;
}

/**
 * O painel de **um** negócio. Renderizado no servidor; o único
 * JavaScript que chega ao browser são as ações de linha, que precisam
 * confirmar uma exclusão.
 *
 * O vocabulário vem do perfil: no papel de parede a tabela de compras
 * se chama "Papel de parede" e a de serviços, "Aplicações". A conta por
 * trás é a mesma nos dois — só o rótulo muda.
 */
export function PainelOperacao({ resumo, periodo, perfil }: Props) {
  const { consolidado, mercadoria, servicos } = resumo;
  const base = caminhoDoNegocio(perfil);

  // A seção de serviços some quando o negócio não presta serviço — mas
  // nunca se houver algum registrado: esconder a seção esconderia
  // dinheiro que existe.
  const mostrarServicos = perfil.temServicos || resumo.servicosRegistrados.length > 0;

  return (
    <>
      <FiltroDePeriodo base={base} periodo={periodo} />

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

      {mostrarServicos ? (
        <>
          <p className="aviso-projecao">
            Mercadoria entra como <strong>projeção</strong> — é o resultado se o lote vender ao preço
            planejado. Serviço entra como <strong>realizado</strong>: o dinheiro já entrou.
          </p>

          <div className="duas-colunas">
            <BlocoDeLinha
              titulo={perfil.tituloCompras}
              selo="projetado"
              linha={mercadoria}
              rodape={`${resumo.unidadesEmEstoque.toLocaleString("pt-BR")} un. · ${formatarDinheiro(resumo.capitalEmMercadoriaCentavos)} investidos`}
            />
            <BlocoDeLinha
              titulo={perfil.tituloServicos}
              selo="realizado"
              linha={servicos}
              rodape={`${servicos.operacoes} serviço(s)`}
            />
          </div>
        </>
      ) : (
        <p className="aviso-projecao">
          Estes números são <strong>projeção</strong>: o resultado se cada lote vender ao preço
          planejado. {resumo.unidadesEmEstoque.toLocaleString("pt-BR")} unidades em estoque,{" "}
          {formatarDinheiro(resumo.capitalEmMercadoriaCentavos)} investidos.
        </p>
      )}

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
          <p className="secao-titulo">{perfil.tituloCompras}</p>
          <Link href={`${base}/compras/nova`} className="botao botao-secundario">
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
                    <th>{perfil.rotuloColunaCompra}</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Investido</th>
                    <th className="num">Receita</th>
                    <th className="num">Lucro</th>
                    <th className="num">Margem</th>
                    <th className="coluna-acoes">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.compras.map((compra) => (
                    <LinhaDeCompra key={compra.id} compra={compra} base={base} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {mostrarServicos ? (
        <section>
          <div className="secao-cabecalho">
            <p className="secao-titulo">{perfil.tituloServicos}</p>
            <Link href={`${base}/servicos/novo`} className="botao botao-secundario">
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
                      <th className="coluna-acoes">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.servicosRegistrados.map((servico) => (
                      <LinhaDeServico key={servico.id} servico={servico} base={base} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

function LinhaDeCompra({ compra, base }: { compra: CompraDto; base: string }) {
  const r = compra.resultado;
  const faixa = r.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(r.margemLiquida);

  return (
    <tr>
      <td>
        <Link href={`${base}/compras/${compra.id}`} className="celula-principal">
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
      <td className="coluna-acoes">
        <AcoesDaLinha
          href={`${base}/compras/${compra.id}`}
          recurso="compras"
          id={compra.id}
          rotulo={compra.descricao}
        />
      </td>
    </tr>
  );
}

function LinhaDeServico({ servico, base }: { servico: ServicoDto; base: string }) {
  const r = servico.resultado;
  const faixa = r.lucroLiquidoCentavos < 0 ? "ruim" : faixaDeMargem(r.margemLiquida);

  return (
    <tr>
      <td>
        <Link href={`${base}/servicos/${servico.id}`} className="celula-principal">
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
      <td className="coluna-acoes">
        <AcoesDaLinha
          href={`${base}/servicos/${servico.id}`}
          recurso="servicos"
          id={servico.id}
          rotulo={servico.descricao}
        />
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
