import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
}

export class TokenService {
  constructor(private secret: string) {
    if (!secret || secret.trim() === "") {
      throw new Error(
        "Application configuration error: JWT_SECRET not defined"
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
      console.error("Error verifying token:", error);
      return null;
    }
  }

  generateAccessToken(userId: string): string {
    return this.generateToken(userId);
  }
}
