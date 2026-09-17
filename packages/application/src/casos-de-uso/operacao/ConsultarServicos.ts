import { ServicoId } from "@advice/domain";
import type { FiltroOperacao, ServicoRepository } from "@advice/domain";
import type { ServicoDto } from "./dtos";
import { servicoParaDto } from "./mapeadores";

export interface ConsultarServicosDeps {
  servicoRepository: ServicoRepository;
}

export async function listarServicos(
  deps: ConsultarServicosDeps,
  filtro?: FiltroOperacao,
): Promise<ServicoDto[]> {
  const servicos = await deps.servicoRepository.listar(filtro);
  return servicos.map(servicoParaDto);
}

export async function buscarServico(id: string, deps: ConsultarServicosDeps): Promise<ServicoDto | null> {
  const servico = await deps.servicoRepository.buscarPorId(ServicoId.de(id));
  return servico ? servicoParaDto(servico) : null;
}
