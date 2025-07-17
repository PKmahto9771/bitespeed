import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { reconcileContact } from '../utils/reconcile';

const prisma = new PrismaClient();

export const identify = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'email or phoneNumber required' });
  }

  try {
    const result = await reconcileContact(prisma, email, phoneNumber);
    return res.status(200).json({ contact: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
