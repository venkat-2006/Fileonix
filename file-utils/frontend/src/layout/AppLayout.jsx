import Navbar from "../components/Navbar";

export default function AppLayout({ children, session }) {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar session={session} />
            <div className="max-w-6xl mx-auto px-6 py-10 animate-fade">
                {children}
            </div>
        </div>
    );
}