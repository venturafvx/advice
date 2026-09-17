export class HabitoNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Hábito ${id} não encontrado`);
    this.name = "HabitoNaoEncontradoError";
  }
}

export class HabitoDuplicadoError extends Error {
  constructor(nome: string) {
    super(`Já existe um hábito chamado "${nome}"`);
    this.name = "HabitoDuplicadoError";
  }
}
