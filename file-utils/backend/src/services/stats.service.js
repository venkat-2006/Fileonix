import { supabase } from "../config/supabase.js";

export const getUserStats = async (userId) => {
  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message);

  return data;
};