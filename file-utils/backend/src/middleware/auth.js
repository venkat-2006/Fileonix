import { supabase } from "../config/supabase.js";

export const verifyAuth = async (req, res, next) => {

  console.log("HEADERS:", req.headers);
  console.log("AUTH HEADER:", req.headers.authorization);

  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);

  if (error)
    return res.status(401).json({ error: "Invalid token" });

  req.user = {
    id: data.user.id,
    email: data.user.email,
  };

  await supabase
    .from("user_stats")
    .upsert({ user_id: data.user.id });

  next();
};