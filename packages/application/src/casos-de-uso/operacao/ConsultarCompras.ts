import { CompraId } from "@advice/domain";
import type { CompraRepository, FiltroOperacao } from "@advice/domain";
import type { CompraDto } from "./dtos";
import { compraParaDto } from "./mapeadores";

export interface ConsultarComprasDeps {
  compraRepository: CompraRepository;
}

export async function listarCompras(
  deps: ConsultarComprasDeps,
  filtro?: FiltroOperacao,
): Promise<CompraDto[]> {
  const compras = await deps.compraRepository.listar(filtro);
  return compras.map(compraParaDto);
}

export async function buscarCompra(id: string, deps: ConsultarComprasDeps): Promise<CompraDto | null> {
  const compra = await deps.compraRepository.buscarPorId(CompraId.de(id));
  return compra ? compraParaDto(compra) : null;
}
