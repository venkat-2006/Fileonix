import { useEffect } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  window.api = api;

  // ✅ Backend test call
  useEffect(() => {
    window.supabase = supabase; 
    const testCall = async () => {
      try {
        const res = await api.get("/test");
        console.log("Backend response:", res.data);
      } catch (err) {
        console.error(
          "API Error:",
          err.response?.data || err.message
        );
      }
    };

    testCall();
  }, []);

  // ✅ Logout handler
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/"); // redirect to auth page
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          Dashboard 
        </h1>

        <button
          onClick={handleLogout}
          className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      <p className="mt-6 text-gray-400">
        You are logged in 
      </p>

    </div>
  );
}