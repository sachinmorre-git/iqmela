/**
 * Clerk global type augmentation.
 *
 * Extend Clerk's publicMetadata shape so that `role` is recognised as a
 * typed union throughout the entire codebase.  Keep this list in sync with
 * the `Role` enum in prisma/schema.prisma.
 */
export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: "candidate" | "interviewer" | "admin";
    };
  }
}

// Augment Clerk's UserPublicMetadata so server-side helpers such as
// `clerkClient().users.getUser()` return a fully-typed metadata object.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface UserPublicMetadata {
    role?: "candidate" | "interviewer" | "admin";
  }
}
