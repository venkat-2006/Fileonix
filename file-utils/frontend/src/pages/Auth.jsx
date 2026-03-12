import { supabase } from "../lib/supabase";
// import { useNavigate } from "react-router-dom";

export default function Auth() {
  // const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white shadow-lg rounded-xl p-10 w-96 text-center">
        <h1 className="text-2xl font-bold mb-4">
          Welcome to Fileonix
        </h1>

        <p className="text-gray-500 mb-6">
          Convert, extract and optimize your files securely.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Sign In with Google
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Files auto-delete after 2 hours.
        </p>
      </div>
    </div>
  );
}