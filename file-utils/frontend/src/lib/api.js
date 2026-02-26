import axios from "axios";
import { supabase } from "./supabase";

export const api = axios.create({
  baseURL: "http://localhost:4000/api", // adjust later for prod
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});