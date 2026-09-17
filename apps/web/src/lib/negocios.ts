import { Negocio, ehNegocio } from "@advice/domain";

/**
 * O que a interface precisa saber sobre cada negócio.
 *
 * Só o identificador (`Negocio`) é domínio; nome, vocabulário e quais
 * seções aparecem são **apresentação** e ficam aqui de propósito. A
 * matemática do papel de parede e a do marketplace é a mesma — o que
 * muda é como o fundador chama as coisas e o que ele espera ver na
 * tela. Nada disto é invariante: o dia em que a Venturax vender um
 * serviço, isso é uma linha trocada aqui, não uma migration.
 */
export interface PerfilDeNegocio {
  negocio: Negocio;
  /** Segmento de URL. Fechado e validado — ver `perfilPorSlug`. */
  slug: string;
  nome: string;
  atividade: string;
  /** Como o painel chama um lote comprado. */
  tituloCompras: string;
  rotuloColunaCompra: string;
  exemploCompra: string;
  /**
   * Se a seção de serviços faz parte da rotina deste negócio. Quando
   * `false` a seção some — mas só se de fato não houver serviço
   * registrado, senão o painel esconderia dinheiro que existe.
   */
  temServicos: boolean;
  tituloServicos: string;
  exemploServico: string;
}

export const PERFIS: Record<Negocio, PerfilDeNegocio> = {
  [Negocio.FABIOJUNIORDECOR]: {
    negocio: Negocio.FABIOJUNIORDECOR,
    slug: "fabiojuniordecor",
    nome: "Fabio Junior Decor",
    atividade: "Papel de parede — venda do material e serviço de aplicação",
    tituloCompras: "Papel de parede",
    rotuloColunaCompra: "Material",
    exemploCompra: "Ex: Rolo importado geométrico — 12 rolos",
    temServicos: true,
    tituloServicos: "Aplicações",
    exemploServico: "Ex: Papel de parede — sala, 18 m²",
  },
  [Negocio.VENTURAX]: {
    negocio: Negocio.VENTURAX,
    slug: "venturax",
    nome: "Venturax",
    atividade: "Compra e revenda de produtos em marketplace",
    tituloCompras: "Produtos",
    rotuloColunaCompra: "Produto",
    exemploCompra: "Ex: Caixa com 50 luminárias LED",
    temServicos: false,
    tituloServicos: "Serviços",
    exemploServico: "Ex: Serviço prestado",
  },
};

export const PERFIS_LISTA: readonly PerfilDeNegocio[] = [
  PERFIS[Negocio.FABIOJUNIORDECOR],
  PERFIS[Negocio.VENTURAX],
];

const POR_SLUG = new Map(PERFIS_LISTA.map((perfil) => [perfil.slug, perfil]));

/**
 * `null` para slug desconhecido — quem chama devolve 404. É o que
 * mantém `/operacao/[negocio]` sem ambiguidade com `/operacao/categorias`:
 * o Next já resolve o segmento estático primeiro, e aqui nenhum outro
 * slug é aceito.
 */
export function perfilPorSlug(slug: string | undefined): PerfilDeNegocio | null {
  return slug ? (POR_SLUG.get(slug) ?? null) : null;
}

export function perfilDe(negocio: Negocio): PerfilDeNegocio {
  return PERFIS[negocio];
}

/** Base de toda URL do negócio — usada por links, redirects e formulários. */
export function caminhoDoNegocio(perfil: PerfilDeNegocio): string {
  return `/operacao/${perfil.slug}`;
}

export function negocioDeSlug(slug: string): Negocio | null {
  return POR_SLUG.get(slug)?.negocio ?? null;
}

export { ehNegocio };
