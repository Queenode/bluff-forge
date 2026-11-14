import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Sign-in is handled by Clerk. Without Clerk keys (local recording) requests pass through.
export default process.env.CLERK_SECRET_KEY ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|ndjson)).*)',
    '/(api|trpc)(.*)',
  ],
};
