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
      throw new Error("Error retrieving user:" + JSON.stringify(error));
    }
  }

  async incrementTranscriptionsCompleted(userId: string): Promise<void> {
    try {
      const userExists = await this.get(userId);

      if (!userExists) return;

      await prismaDB.user.update({
        where: {
          id: userId,
        },
        data: {
          qtdTranscriptionsCompleted: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      throw new Error(
        "Error incrementing transcriptions completed:" + JSON.stringify(error)
      );
    }
  }
}
