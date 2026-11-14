'use client';

import { ClerkProvider, SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import type { ReactNode } from 'react';

/** Sign-in with email code or Google (Clerk). Without Clerk keys (local dev) everyone counts as signed in. */
export const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!HAS_CLERK) return <>{children}</>;
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: '#10b981' },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

function useClerkSession() {
  const { isLoaded, isSignedIn } = useAuth();
  return { ready: isLoaded, signedIn: !!isSignedIn };
}
const useDevSession = () => ({ ready: true, signedIn: true });

export const useSession = HAS_CLERK ? useClerkSession : useDevSession;

/** Renders children as-is when signed in; otherwise clicking opens the sign-in modal. */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { signedIn } = useSession();
  if (signedIn || !HAS_CLERK) return <>{children}</>;
  return <SignInButton mode="modal">{children}</SignInButton>;
}

export function AccountButton() {
  const { ready, signedIn } = useSession();
  if (!HAS_CLERK || !ready) return null;
  if (signedIn) return <UserButton />;
  return (
    <SignInButton mode="modal">
      <button className="px-4 py-2 clip-game-btn bg-emerald-500 hover:bg-emerald-400 text-[#03060a] text-[11px] font-display font-black uppercase tracking-wider">
        Sign in
      </button>
    </SignInButton>
  );
}
