-- Local email sign-in when the hosted auth provider is unreachable.
ALTER TABLE "AppUser" ADD COLUMN "passwordHash" TEXT;
