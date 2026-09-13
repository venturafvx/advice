import { ModoDeCusto, type ResultadoFinanceiro } from "@advice/domain";
import { faixaDeMargem, formatarDinheiro, formatarFracao, formatarPontosBase } from "@/lib/formato";

interface Props {
  resultado: ResultadoFinanceiro;
  /** Ausente em serviço — não há lote, então não há "por unidade". */
  quantidade?: number;
}

/**
 * O painel financeiro de uma operação. Server e client renderizam o
 * mesmo componente a partir do mesmo `ResultadoFinanceiro` calculado
 * pelo domínio — no editor ele atualiza a cada tecla, na listagem ele
 * vem do banco, e os dois chegam sempre ao mesmo número.
 */
export function PainelResultado({ resultado, quantidade }: Props) {
  const prejuizo = resultado.lucroLiquidoCentavos < 0;
  const faixa = prejuizo ? "ruim" : faixaDeMargem(resultado.margemLiquida);

  return (
    <div className="painel-resultado">
      <div className="resultado-destaque">
        <span className="rotulo-secao">{prejuizo ? "Prejuízo" : "Lucro líquido"}</span>
        <p className={`resultado-valor ${prejuizo ? "negativo" : "positivo"}`}>
          {formatarDinheiro(resultado.lucroLiquidoCentavos)}
        </p>
        <span className={`chip ${faixa}`}>{formatarFracao(resultado.margemLiquida)} de margem líquida</span>
      </div>

      <BarraDeComposicao resultado={resultado} />

      <dl className="resultado-linhas">
        <Linha rotulo="Receita bruta" valor={formatarDinheiro(resultado.receitaBrutaCentavos)} forte />
        {resultado.custoMercadoriaCentavos > 0 ? (
          <Linha
            rotulo="Custo da mercadoria"
            valor={`− ${formatarDinheiro(resultado.custoMercadoriaCentavos)}`}
          />
        ) : null}
        <Linha
          rotulo="Lucro bruto"
          valor={formatarDinheiro(resultado.lucroBrutoCentavos)}
          nota={formatarFracao(resultado.margemBruta)}
        />

        {resultado.custosDetalhados.length > 0 ? (
          <>
            <div className="resultado-separador" />
            {resultado.custosDetalhados.map((custo, indice) => (
              <Linha
                key={`${custo.rotulo}-${indice}`}
                rotulo={custo.rotulo}
                nota={descreverIncidencia(custo.modo, custo.valor)}
                valor={`− ${formatarDinheiro(custo.totalCentavos)}`}
                sutil
              />
            ))}
            <Linha
              rotulo="Custos de operação"
              valor={`− ${formatarDinheiro(resultado.custosOperacionaisCentavos)}`}
            />
          </>
        ) : null}

        <div className="resultado-separador" />
        <Linha
          rotulo={prejuizo ? "Prejuízo" : "Lucro líquido"}
          valor={formatarDinheiro(resultado.lucroLiquidoCentavos)}
          nota={formatarFracao(resultado.margemLiquida)}
          forte
        />
      </dl>

      <div className="resultado-indicadores">
        {quantidade !== undefined ? (
          <Indicador rotulo="Lucro por unidade" valor={formatarDinheiro(resultado.lucroPorUnidadeCentavos)} />
        ) : null}
        <Indicador
          rotulo="Retorno sobre o custo"
          valor={formatarFracao(resultado.retornoSobreCusto)}
          ajuda="Quanto sobra em cima de cada real investido nesta operação"
        />
        <Indicador
          rotulo={quantidade !== undefined ? "Preço mínimo / un." : "Valor mínimo do serviço"}
          valor={
            resultado.precoMinimoUnitarioCentavos === null
              ? "impossível"
              : formatarDinheiro(resultado.precoMinimoUnitarioCentavos)
          }
          ajuda="Abaixo disso a operação fecha no vermelho"
        />
        {quantidade !== undefined ? (
          <Indicador
            rotulo="Empata vendendo"
            valor={
              resultado.unidadesParaEmpatar === null
                ? "nunca"
                : `${resultado.unidadesParaEmpatar} de ${quantidade} un.`
            }
            ajuda="Unidades necessárias para cobrir os custos fixos do lote"
          />
        ) : null}
      </div>
    </div>
  );
}

function BarraDeComposicao({ resultado }: { resultado: ResultadoFinanceiro }) {
  const prejuizo = resultado.lucroLiquidoCentavos < 0;
  const base = prejuizo ? resultado.custoTotalCentavos : resultado.receitaBrutaCentavos;

  if (base <= 0) {
    return <div className="composicao vazia" aria-hidden="true" />;
  }

  const fatia = (valor: number): string => `${Math.max(0, (valor / base) * 100)}%`;

  // Em prejuízo a conta muda de pergunta. Não dá para desenhar "lucro"
  // como uma quarta fatia da receita: o custo já estourou a receita, e
  // as fatias passariam de 100%. A barra passa a representar o custo
  // total, dividido entre a parte que a receita cobriu e o buraco.
  if (prejuizo) {
    return (
      <div
        className="composicao"
        role="img"
        aria-label={`A receita de ${formatarDinheiro(resultado.receitaBrutaCentavos)} cobre parte do custo de ${formatarDinheiro(resultado.custoTotalCentavos)}; faltam ${formatarDinheiro(-resultado.lucroLiquidoCentavos)}`}
      >
        <span className="faixa-mercadoria" style={{ width: fatia(resultado.receitaBrutaCentavos) }} />
        <span className="faixa-prejuizo" style={{ width: fatia(-resultado.lucroLiquidoCentavos) }} />
      </div>
    );
  }

  return (
    <div
      className="composicao"
      role="img"
      aria-label={`Da receita de ${formatarDinheiro(resultado.receitaBrutaCentavos)}: mercadoria ${formatarDinheiro(resultado.custoMercadoriaCentavos)}, custos ${formatarDinheiro(resultado.custosOperacionaisCentavos)}, lucro ${formatarDinheiro(resultado.lucroLiquidoCentavos)}`}
    >
      <span className="faixa-mercadoria" style={{ width: fatia(resultado.custoMercadoriaCentavos) }} />
      <span className="faixa-custos" style={{ width: fatia(resultado.custosOperacionaisCentavos) }} />
      <span className="faixa-lucro" style={{ width: fatia(resultado.lucroLiquidoCentavos) }} />
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  nota,
  forte,
  sutil,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  forte?: boolean;
  sutil?: boolean;
}) {
  return (
    <div className={`resultado-linha${forte ? " forte" : ""}${sutil ? " sutil" : ""}`}>
      <dt>
        {rotulo}
        {nota ? <span className="nota">{nota}</span> : null}
      </dt>
      <dd className="num">{valor}</dd>
    </div>
  );
}

function Indicador({ rotulo, valor, ajuda }: { rotulo: string; valor: string; ajuda?: string }) {
  return (
    <div className="indicador" title={ajuda}>
      <span className="rotulo">{rotulo}</span>
      <span className="valor num">{valor}</span>
    </div>
  );
}

function descreverIncidencia(modo: ModoDeCusto, valor: number): string {
  switch (modo) {
    case ModoDeCusto.VALOR_FIXO:
      return "fixo";
    case ModoDeCusto.POR_UNIDADE:
      return `${formatarDinheiro(valor)} / un.`;
    case ModoDeCusto.PERCENTUAL_DA_VENDA:
      return formatarPontosBase(valor);
  }
}
