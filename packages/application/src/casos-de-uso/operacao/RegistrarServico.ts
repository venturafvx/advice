import { Dinheiro, Servico, ServicoId } from "@advice/domain";
import type { CategoriaDeCustoRepository, ServicoRepository } from "@advice/domain";
import type { CustoEntrada, ServicoDto } from "./dtos";
import { ServicoNaoEncontradoError } from "./erros";
import { servicoParaDto } from "./mapeadores";
import { montarCustos } from "./montarCustos";

export interface ServicoInput {
  descricao: string;
  cliente: string | null;
  valorRecebidoCentavos: number;
  recebidoEm: Date;
  observacao: string | null;
  custos: readonly CustoEntrada[];
}

export interface ServicoDeps {
  servicoRepository: ServicoRepository;
  categoriaRepository: CategoriaDeCustoRepository;
}

export async function registrarServico(input: ServicoInput, deps: ServicoDeps): Promise<ServicoDto> {
  const servico = Servico.criar({
    descricao: input.descricao,
    cliente: input.cliente,
    valorRecebido: Dinheiro.deCentavos(input.valorRecebidoCentavos),
    custos: await montarCustos(input.custos, deps.categoriaRepository),
    recebidoEm: input.recebidoEm,
    observacao: input.observacao,
  });

  await deps.servicoRepository.salvar(servico);
  return servicoParaDto(servico);
}

export async function atualizarServico(
  id: string,
  input: ServicoInput,
  deps: ServicoDeps,
): Promise<ServicoDto> {
  const servico = await deps.servicoRepository.buscarPorId(ServicoId.de(id));
  if (!servico) {
    throw new ServicoNaoEncontradoError(id);
  }

  servico.atualizar({
    descricao: input.descricao,
    cliente: input.cliente,
    valorRecebido: Dinheiro.deCentavos(input.valorRecebidoCentavos),
    custos: await montarCustos(input.custos, deps.categoriaRepository),
    recebidoEm: input.recebidoEm,
    observacao: input.observacao,
  });

  await deps.servicoRepository.salvar(servico);
  return servicoParaDto(servico);
}

export async function excluirServico(
  id: string,
  deps: Pick<ServicoDeps, "servicoRepository">,
): Promise<void> {
  const servicoId = ServicoId.de(id);
  const servico = await deps.servicoRepository.buscarPorId(servicoId);
  if (!servico) {
    throw new ServicoNaoEncontradoError(id);
  }
  await deps.servicoRepository.excluir(servicoId);
}
