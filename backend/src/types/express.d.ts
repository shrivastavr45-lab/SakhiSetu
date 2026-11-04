import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Locals {
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
