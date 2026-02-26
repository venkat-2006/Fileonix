import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // ✅ Check session on load
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        navigate("/dashboard");
      }
    };

    checkSession();
  }, [navigate]);

  // ✅ Google Login
  const handleGoogleAuth = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });

      if (error) throw error;

    } catch (err) {
      console.error("Google Auth Error:", err.message);
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="bg-white p-10 rounded-xl w-96 text-center space-y-6">

        <h1 className="text-2xl font-bold">
          Welcome to Fileonix 🚀
        </h1>

        <p className="text-gray-500 text-sm">
          Sign in / Sign up with Google
        </p>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className={`w-full border p-3 rounded transition
            ${loading
              ? "bg-gray-200 cursor-not-allowed"
              : "hover:bg-gray-100"
            }`}
        >
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

      </div>
    </div>
  );
}