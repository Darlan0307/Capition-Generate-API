export type User = {
  id: string;
  providerId: string | null;
  providerName: string | null;
  email: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  website: string | null;
  isPremium: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  currentPeriodEndAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
