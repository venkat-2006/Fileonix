import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="space-y-32">

      {/* HERO SECTION */}
      <section className="text-center pt-20">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight">
          Convert, Extract & Optimize Files — Instantly.
        </h1>

        <p className="mt-6 text-lg text-gray-600">
          Free. Secure. Auto-deleted in 2 hours.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate("/auth")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            🚀 Sign In with Google
          </button>

          <button
            onClick={() =>
              document.getElementById("features").scrollIntoView({
                behavior: "smooth",
              })
            }
            className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-100 transition"
          >
            📄 Explore Features
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-6 text-sm text-gray-500">
          <span>🔒 Files auto-delete</span>
          <span>⚡ Fast processing</span>
          <span>📊 Usage tracking</span>
          <span>🌍 Cloud-powered</span>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features">
        <h2 className="text-3xl font-bold text-center mb-12">
          Powerful File Tools
        </h2>

        <div className="grid md:grid-cols-4 gap-8">
          <FeatureCard
            icon="📄"
            title="File Conversion"
            desc="Convert PDFs, images, and documents instantly."
          />
          <FeatureCard
            icon="🔎"
            title="OCR Extraction"
            desc="Extract text from scanned PDFs and images."
          />
          <FeatureCard
            icon="📉"
            title="Compression"
            desc="Reduce file size without losing quality."
          />
          <FeatureCard
            icon="📊"
            title="Similarity Detection"
            desc="Compare documents intelligently."
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="text-center">
        <h2 className="text-3xl font-bold mb-12">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-12">
          <StepCard step="1️⃣" text="Sign in with Google" />
          <StepCard step="2️⃣" text="Upload your file" />
          <StepCard step="3️⃣" text="Download results instantly" />
        </div>
      </section>

      {/* PRIVACY SECTION */}
      <section id="privacy" className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <h2 className="text-3xl font-bold mb-6">
          Privacy First
        </h2>

        <p className="text-gray-600 max-w-2xl mx-auto">
          We never store your files permanently. Files are deleted after
          2 hours. Job logs are retained only for 7 days. Usage stats
          are stored only for quota tracking.
        </p>
      </section>

      {/* FINAL CTA */}
      <section className="text-center">
        <h2 className="text-3xl font-bold mb-6">
          Ready to convert your files?
        </h2>

        <button
          onClick={() => navigate("/auth")}
          className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-blue-700 transition"
        >
          Sign In with Google
        </button>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-gray-400 text-sm py-10 border-t">
        © 2026 Fileonix. Privacy-focused file tools.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm">{desc}</p>
    </div>
  );
}

function StepCard({ step, text }) {
  return (
    <div className="space-y-4">
      <div className="text-4xl">{step}</div>
      <p className="text-gray-600">{text}</p>
    </div>
  );
}