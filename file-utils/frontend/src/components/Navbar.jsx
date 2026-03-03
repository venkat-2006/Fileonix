import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Navbar({ session }) {
    const navigate = useNavigate();

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <nav className="sticky top-0 bg-white/80 backdrop-blur-md shadow-sm px-6 py-4 flex justify-between items-center z-50">
            <div
                className="text-xl font-bold text-blue-600 cursor-pointer"
                onClick={() => navigate("/")}
            >
                Fileonix
            </div>

            {!session ? (
                <div className="flex items-center gap-6">
                    <a href="#features" className="text-gray-600 hover:text-blue-600">
                        Features
                    </a>
                    <a href="#how" className="text-gray-600 hover:text-blue-600">
                        How It Works
                    </a>
                    <a href="#privacy" className="text-gray-600 hover:text-blue-600">
                        Privacy
                    </a>
                    <button
                        onClick={() => navigate("/auth")}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Sign In with Google
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate("/dashboard")}>
                        Dashboard
                    </button>
                    <button onClick={() => navigate("/upload")}>
                        Upload
                    </button>
                    <button
                        onClick={handleLogout}
                        className="text-red-500 hover:underline"
                    >
                        Logout
                    </button>
                </div>
            )}
        </nav>
    );
}