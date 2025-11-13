import { ddbDocument } from '@/lib/dynamo';
import { DynamoDBAdapter } from '@auth/dynamodb-adapter';
import type { NextAuthOptions } from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
const adapter = DynamoDBAdapter(ddbDocument, {
  tableName: process.env.NEXTAUTH_TABLE,
});
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

interface AdapterUserWithPassword extends AdapterUser {
  passwordHash: string;
}

export const options: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',

      credentials: {
        id: { label: 'ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.id || !credentials?.password) {
          throw new Error('Required: id, password');
        }

        const email = credentials.id.trim().toLowerCase();
        const password = credentials.password;

        // biome-ignore lint/style/noNonNullAssertion: adapter
        const existingUser = await adapter.getUserByEmail!(email);
        if (!existingUser) {
          const passwordHash = await bcrypt.hash(password, 12);

          // biome-ignore lint/style/noNonNullAssertion: adapter
          const newUser = await adapter.createUser!({
            id: uuidv4(),
            email,
            emailVerified: null,
            name: null,
            passwordHash,
          } as AdapterUserWithPassword);

          return newUser;
        }

        const passwordHash = (existingUser as AdapterUserWithPassword)
          .passwordHash;
        if (!passwordHash) {
          throw new Error('Password not found');
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          passwordHash,
        );
        if (!isValid) {
          throw new Error('Incorrect: id, password');
        }

        return {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        };
      },
    }),
  ],
  adapter,
  debug: true,
  session: {
    strategy: 'jwt',
  },
};
