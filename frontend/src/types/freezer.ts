export type Freezer = {
  id: number;
  nome: string;
};

export type FreezerInput = Pick<Freezer, "nome">;
