import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type SignUpInput = {
  email: string;
  full_name: string;
  password: string;
  phone_e164: string;
  signup_invite_code: string;
};

export type AuthContextValue = {
  accessToken: string | null;
  clearPasswordRecovery: () => Promise<void>;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  recoveryError: string | null;
  registerBeforeSignOutCleanup: (cleanup: () => Promise<void>) => () => void;
  resetPassword: (email: string) => Promise<void>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  user: User | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
