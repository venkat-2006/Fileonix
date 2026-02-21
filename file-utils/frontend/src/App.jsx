import { supabase } from "./lib/supabase";

export default function App() {
  console.log("Supabase:", supabase);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">
        Fileonix Frontend Ready 🚀
      </h1>
    </div>
  );
}