import { Compra, CompraId, Dinheiro } from "@advice/domain";
import type { CategoriaDeCustoRepository, CompraRepository } from "@advice/domain";
import type { CompraDto, CustoEntrada } from "./dtos";
import { CompraNaoEncontradaError } from "./erros";
import { compraParaDto } from "./mapeadores";
import { montarCustos } from "./montarCustos";

export interface CompraInput {
  descricao: string;
  quantidade: number;
  custoUnitarioCentavos: number;
  precoVendaUnitarioCentavos: number;
  compradoEm: Date;
  observacao: string | null;
  custos: readonly CustoEntrada[];
}

export interface CompraDeps {
  compraRepository: CompraRepository;
  categoriaRepository: CategoriaDeCustoRepository;
}

export async function registrarCompra(input: CompraInput, deps: CompraDeps): Promise<CompraDto> {
  const compra = Compra.criar({
    descricao: input.descricao,
    quantidade: input.quantidade,
    custoUnitario: Dinheiro.deCentavos(input.custoUnitarioCentavos),
    precoVendaUnitario: Dinheiro.deCentavos(input.precoVendaUnitarioCentavos),
    custos: await montarCustos(input.custos, deps.categoriaRepository),
    compradoEm: input.compradoEm,
    observacao: input.observacao,
  });

  await deps.compraRepository.salvar(compra);
  return compraParaDto(compra);
}

export async function atualizarCompra(id: string, input: CompraInput, deps: CompraDeps): Promise<CompraDto> {
  const compra = await deps.compraRepository.buscarPorId(CompraId.de(id));
  if (!compra) {
    throw new CompraNaoEncontradaError(id);
  }

  compra.atualizar({
    descricao: input.descricao,
    quantidade: input.quantidade,
    custoUnitario: Dinheiro.deCentavos(input.custoUnitarioCentavos),
    precoVendaUnitario: Dinheiro.deCentavos(input.precoVendaUnitarioCentavos),
    custos: await montarCustos(input.custos, deps.categoriaRepository),
    compradoEm: input.compradoEm,
    observacao: input.observacao,
  });

  await deps.compraRepository.salvar(compra);
  return compraParaDto(compra);
}

export async function excluirCompra(id: string, deps: Pick<CompraDeps, "compraRepository">): Promise<void> {
  const compraId = CompraId.de(id);
  const compra = await deps.compraRepository.buscarPorId(compraId);
  if (!compra) {
    throw new CompraNaoEncontradaError(id);
  }
  await deps.compraRepository.excluir(compraId);
}
