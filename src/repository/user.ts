import { User } from "../@types/user";
import { prismaDB } from "../lib";

export class PrismaUserRepository {
  async get(id: string): Promise<User | null> {
    try {
      const user = await prismaDB.user.findUnique({
        where: {
          id,
        },
      });

      if (!user) {
        return null;
      }

      return user;
    } catch (error) {
      throw new Error("Erro ao buscar o usuário" + JSON.stringify(error));
    }
  }
}
