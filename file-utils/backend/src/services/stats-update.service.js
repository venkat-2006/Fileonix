import { supabase } from "../config/supabase.js";

export const incrementJobStats = async (userId) => {
  const { error } = await supabase.rpc("increment_jobs", {
    uid: userId,
  });

  if (error) throw new Error(error.message);
};

export const incrementOCRStats = async (userId) => {
  const { error } = await supabase.rpc("increment_ocr", {
    uid: userId,
  });

  if (error) throw new Error(error.message);
};