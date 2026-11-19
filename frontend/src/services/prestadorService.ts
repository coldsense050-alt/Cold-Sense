import type { FreezerChanges, Prestador, PrestadorFields, PrestadorRow, PrestadorSnapshot } from "../features/prestadores/types";
import { supabase } from "./supabaseClient";

// Busca os prestadores
export async function getPrestadores(): Promise<Prestador[]> {
  const { data, error } = await supabase
    .from("prestadores_manutencao")
    .select(
      "id, nome, email, telefone, ativo, criado_em, freezers_prestadores(freezer_id, freezer:freezers(id, nome))",
    )
    .order("nome", { ascending: true })
    .overrideTypes<PrestadorRow[], { merge: false }>();

  if (error) throw new Error("Não foi possível carregar os prestadores. Tente novamente.");

  return (data ?? []).map(({ freezers_prestadores, ...prestador }) => ({
    ...prestador,
    freezers: (freezers_prestadores ?? [])
      .map(({ freezer_id, freezer }) => freezer ?? { id: freezer_id, nome: `Freezer #${freezer_id}` })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  }));
}

export async function savePrestador(id: number | null, fields: PrestadorFields, freezerIds: number[]): Promise<number> {
  const snapshot = id !== null ? await getPrestadorSnapshot(id) : null;
  const savedId = await savePrestadorRecord(id, fields);
  const previousIds = (snapshot?.freezers_prestadores ?? []).map((link) => link.freezer_id);
  const changes = calculateFreezerChanges(previousIds, freezerIds);

  try {
    await syncPrestadorFreezers(savedId, changes);
  } catch (linkError) {
    try {
      await restorePrestador(savedId, snapshot, changes);
    } catch {
      throw new Error("O salvamento não foi concluído e parte dos dados pode ter sido alterada. Atualize a lista antes de tentar novamente.");
    }
    throw savingError(linkError);
  }

  return savedId;
}

export async function deletePrestador(id: number): Promise<void> {
  const { error } = await supabase
    .from("prestadores_manutencao")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23503") {
      throw new Error("Este prestador está sendo usado em outros registros e não pode ser excluído.");
    }
    throw new Error("Não foi possível excluir o prestador. Tente novamente.");
  }
}

// busca estado do prestador antes do salvamento
async function getPrestadorSnapshot(id: number): Promise<PrestadorSnapshot> {
  const { data, error } = await supabase
    .from("prestadores_manutencao")
    .select("nome, email, telefone, ativo, freezers_prestadores(freezer_id)")
    .eq("id", id)
    .single()
    .overrideTypes<PrestadorSnapshot, { merge: false }>();

  if (error) throw new Error("Não foi possível carregar os dados atuais do prestador. Atualize a lista e tente novamente.");
  return data;
}

async function savePrestadorRecord(id: number | null, fields: PrestadorFields): Promise<number> {
  const write = id === null
    ? supabase.from("prestadores_manutencao").insert(fields)
    : supabase.from("prestadores_manutencao").update(fields).eq("id", id);
  const { data, error } = await write.select("id").single();

  if (error) throw savingError(error);
  return data.id as number;
}

function calculateFreezerChanges(previousIds: number[], freezerIds: number[]): FreezerChanges {
  const selectedIds = [...new Set(freezerIds)];
  return {
    addedIds: selectedIds.filter((freezerId) => !previousIds.includes(freezerId)),
    removedIds: previousIds.filter((freezerId) => !selectedIds.includes(freezerId)),
  };
}

async function syncPrestadorFreezers(prestadorId: number, { addedIds, removedIds }: FreezerChanges): Promise<void> {
  if (addedIds.length > 0) {
    const { error } = await supabase.from("freezers_prestadores").insert(
      addedIds.map((freezerId) => ({ prestador_id: prestadorId, freezer_id: freezerId })),
    );
    if (error) throw error;
  }

  if (removedIds.length > 0) {
    const { data: removed, error } = await supabase
      .from("freezers_prestadores")
      .delete()
      .eq("prestador_id", prestadorId)
      .in("freezer_id", removedIds)
      .select("freezer_id");
    if (error) throw error;
    if (removed.length !== removedIds.length) throw new Error("Vínculos não removidos.");
  }
}

async function restorePrestador(prestadorId: number, snapshot: PrestadorSnapshot | null, { addedIds, removedIds }: FreezerChanges): Promise<void> {
  if (snapshot === null) {
    const { error } = await supabase
      .from("prestadores_manutencao").delete().eq("id", prestadorId).select("id").single();
    if (error) throw error;
    return;
  }

  const { freezers_prestadores: _links, ...previousFields } = snapshot;
  const { error } = await supabase
    .from("prestadores_manutencao").update(previousFields).eq("id", prestadorId).select("id").single();
  if (error) throw error;

  if (removedIds.length > 0) {
    const { error: restoreLinksError } = await supabase.from("freezers_prestadores").upsert(
      removedIds.map((freezerId) => ({ prestador_id: prestadorId, freezer_id: freezerId })),
      { onConflict: "freezer_id,prestador_id" },
    );
    if (restoreLinksError) throw restoreLinksError;
  }

  if (addedIds.length > 0) {
    const { error: cleanupLinksError } = await supabase
      .from("freezers_prestadores").delete().eq("prestador_id", prestadorId).in("freezer_id", addedIds);
    if (cleanupLinksError) throw cleanupLinksError;
  }
}

function savingError(error: unknown): Error {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "23503") {
    return new Error("Um freezer selecionado não está mais disponível. Atualize a página e tente novamente.");
  }
  if (code === "42501") return new Error("Você não tem permissão para salvar este prestador.");
  return new Error("Não foi possível salvar o prestador. Tente novamente.");
}
