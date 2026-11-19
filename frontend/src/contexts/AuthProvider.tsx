import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabaseClient";
import { AuthContext } from "./AuthContext";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // INITIAL_SESSION is emitted after Supabase restores or refreshes the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        const nextUserId = nextSession?.user.id ?? null;

        if (currentUserId.current !== nextUserId || event === "SIGNED_OUT") {
          queryClient.clear();
        }

        currentUserId.current = nextUserId;
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
