import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";

export const verifyAuth = async (req, res, next) => {

  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ error: "Missing token" });

  try {

    const decoded = jwt.decode(token);

    if (!decoded)
      return res.status(401).json({ error: "Invalid token" });

    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    await supabase
      .from("user_stats")
      .upsert({ user_id: decoded.sub });

    next();

  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

};