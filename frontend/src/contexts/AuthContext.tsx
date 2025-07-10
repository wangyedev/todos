import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthState, User } from "../types";
import { Session } from "@supabase/supabase-js";

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        updateAuthState(session);
      } catch (error) {
        console.error("Error getting session:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to load session",
        }));
      }
    };

    getSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      updateAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateAuthState = (session: Session | null) => {
    if (session?.user) {
      const user: User = {
        id: session.user.id,
        email: session.user.email || "",
        name:
          session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name,
        avatarUrl: session.user.user_metadata?.avatar_url,
        provider: session.user.app_metadata?.provider,
        createdAt: session.user.created_at,
        updatedAt: session.user.updated_at || session.user.created_at,
      };

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } else {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return { error: error.message };
      }

      return {};
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return { error: errorMessage };
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || "",
          },
        },
      });

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return { error: error.message };
      }

      return {};
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return { error: errorMessage };
    }
  };

  const signInWithGoogle = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return { error: error.message };
      }

      return {};
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return { error: errorMessage };
    }
  };

  const signOut = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to sign out",
      }));
    }
  };

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
