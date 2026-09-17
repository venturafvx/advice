"use client";

import type { Negocio } from "@advice/domain";
import { PERFIS_LISTA } from "@/lib/negocios";

/**
 * A qual negócio este lançamento pertence.
 *
 * Chega preenchido pela rota — quem entrou por "Fabio Junior Decor"
 * não deveria ter de escolher de novo. O campo existe porque lançar no
 * negócio errado é o engano mais fácil de cometer aqui, e sem ele a
 * única correção seria apagar e redigitar. Controle segmentado em vez
 * de `<select>`: são duas opções, e as duas cabem na tela.
 */
export function SeletorDeNegocioDoLancamento({
  valor,
  aoMudar,
}: {
  valor: Negocio;
  aoMudar: (negocio: Negocio) => void;
}) {
  return (
    <fieldset className="campo campo-negocio">
      <legend>Negócio</legend>
      <div className="segmentado">
        {PERFIS_LISTA.map((perfil) => (
          <label key={perfil.slug} className={valor === perfil.negocio ? "ativo" : ""}>
            <input
              type="radio"
              name="negocio"
              value={perfil.negocio}
              checked={valor === perfil.negocio}
              onChange={() => aoMudar(perfil.negocio)}
            />
            {perfil.nome}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
