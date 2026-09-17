import type { CategoriaDeCusto, Compra, CustoOperacional, Servico } from "@advice/domain";
import type { CategoriaDeCustoDto, CompraDto, CustoDto, ServicoDto } from "./dtos";

function custoParaDto(custo: CustoOperacional): CustoDto {
  return {
    categoriaId: custo.getCategoriaId().toString(),
    categoriaNome: custo.getCategoriaNome(),
    modo: custo.getModo(),
    valor: custo.getValor(),
  };
}

export function compraParaDto(compra: Compra): CompraDto {
  const dados = compra.getDados();
  return {
    id: compra.getId().toString(),
    negocio: dados.negocio,
    descricao: dados.descricao,
    quantidade: dados.quantidade,
    custoUnitarioCentavos: dados.custoUnitario.emCentavos(),
    precoVendaUnitarioCentavos: dados.precoVendaUnitario.emCentavos(),
    compradoEm: dados.compradoEm.toISOString(),
    observacao: dados.observacao,
    custos: dados.custos.map(custoParaDto),
    resultado: compra.calcularResultado(),
  };
}

export function servicoParaDto(servico: Servico): ServicoDto {
  const dados = servico.getDados();
  return {
    id: servico.getId().toString(),
    negocio: dados.negocio,
    descricao: dados.descricao,
    cliente: dados.cliente,
    valorRecebidoCentavos: dados.valorRecebido.emCentavos(),
    recebidoEm: dados.recebidoEm.toISOString(),
    observacao: dados.observacao,
    custos: dados.custos.map(custoParaDto),
    resultado: servico.calcularResultado(),
  };
}

export function categoriaParaDto(categoria: CategoriaDeCusto): CategoriaDeCustoDto {
  return {
    id: categoria.getId().toString(),
    nome: categoria.getNome(),
    modoPadrao: categoria.getModoPadrao(),
    valorPadrao: categoria.getValorPadrao(),
    arquivada: categoria.estaArquivada(),
  };
}
