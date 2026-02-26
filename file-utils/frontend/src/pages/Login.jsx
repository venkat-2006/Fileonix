// import { supabase } from "../lib/supabase";

// export default function Login() {
//   const handleGoogleLogin = async () => {
//     await supabase.auth.signInWithOAuth({
//       provider: "google",
//     });
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-black">
//       <div className="bg-white p-10 rounded-xl w-96 text-center space-y-6">
//         <h1 className="text-2xl font-bold">Welcome Back 👋</h1>

//         <button
//           onClick={handleGoogleLogin}
//           className="w-full border p-3 rounded hover:bg-gray-100 transition"
//         >
//           Continue with Google
//         </button>
//       </div>
//     </div>
//   );
// }