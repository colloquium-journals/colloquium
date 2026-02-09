import { prisma } from '@colloquium/database';

export async function generateUniqueUsername(email: string): Promise<string> {
  let baseUsername = email.toLowerCase().split('@')[0]
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^[^a-z]/, 'u')
    .slice(0, 27);

  if (baseUsername.startsWith('bot-')) {
    baseUsername = 'u' + baseUsername.slice(4);
  }

  const paddedUsername = baseUsername.length < 3
    ? baseUsername + 'x'.repeat(3 - baseUsername.length)
    : baseUsername;

  let username = paddedUsername;
  let suffix = 2;
  while (await prisma.users.findUnique({ where: { username }, select: { id: true } })) {
    username = `${paddedUsername}-${suffix}`;
    suffix++;
  }

  return username;
}
