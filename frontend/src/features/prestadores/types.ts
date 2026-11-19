import type { Freezer } from "../../types/freezer";

export type PrestadorRow = Omit<Prestador, "freezers"> & {
    freezers_prestadores: { freezer_id: number; freezer: Freezer | null }[];
};

export type PrestadorFields = Pick<Prestador, "nome" | "email" | "telefone" | "ativo">;

export type PrestadorSnapshot = PrestadorFields & {
    freezers_prestadores: { freezer_id: number }[];
};

export type FreezerChanges = { addedIds: number[]; removedIds: number[] };

export interface Prestador {
    id: number;
    nome: string;
    email: string | null;
    telefone: string | null;
    ativo: boolean;
    criado_em: string;
    freezers: Freezer[];
}

export interface PrestadorInput {
    nome: string;
    email: string;
    telefone: string;
    ativo: boolean;
    freezerIds: number[];
}
