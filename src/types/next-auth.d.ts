import NextAuth from 'next-auth';
import type { StudioMembershipRole, UserRole } from '@/db/schema';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: UserRole;
      studioId?: string;
      studioStatus?: string;
      memberRole?: StudioMembershipRole;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    role?: UserRole;
    studioId?: string;
    memberRole?: StudioMembershipRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    studioId?: string;
    studioStatus?: string;
    memberRole?: StudioMembershipRole;
  }
}
