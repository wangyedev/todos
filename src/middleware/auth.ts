import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { AuthenticatedRequest } from "../types";

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.user_metadata?.full_name,
      avatarUrl: user.user_metadata?.avatar_url,
      provider: user.app_metadata?.provider || "email",
      createdAt: user.created_at,
      updatedAt: user.updated_at || user.created_at,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
        provider: user.app_metadata?.provider || "email",
        createdAt: user.created_at,
        updatedAt: user.updated_at || user.created_at,
      };
    }

    next();
  } catch (error) {
    console.error("Optional authentication error:", error);
    next();
  }
};
