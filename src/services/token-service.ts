import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
}

export class TokenService {
  constructor(private secret: string) {
    if (!secret || secret.trim() === "") {
      throw new Error(
        "Erro na configuração da aplicação: JWT_SECRET não definido"
      );
    }

    this.secret = secret;
  }

  private generateToken(userId: string): string {
    const payload: TokenPayload = {
      userId,
    };
    return jwt.sign(payload, this.secret, {
      expiresIn: "7d",
    });
  }

  verifyToken(token: string): jwt.JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;

      return decoded;
    } catch (error) {
      console.error("Erro ao verificar token:", error);
      return null;
    }
  }

  generateAccessToken(userId: string): string {
    return this.generateToken(userId);
  }
}
