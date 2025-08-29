import { User } from "../user";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      user: User;
    }

    interface User {
      id: string;
    }
  }
}

export {};
