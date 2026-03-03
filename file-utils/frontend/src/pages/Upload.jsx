import { useState, useEffect } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Upload() {
    const [file, setFile] = useState(null);
    const [conversion, setConversion] = useState("image->pdf");
    const [stats, setStats] = useState(null);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            const res = await api.get("/users/me/stats");
            setStats(res.data);
        };

        fetchStats();
    }, []);

    const handleUpload = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append("files", file);
        formData.append("conversionType", conversion);

        try {
            setLoading(true);

            await api.post("/upload", formData, {
                onUploadProgress: (event) => {
                    const percent = Math.round(
                        (event.loaded * 100) / event.total
                    );
                    setProgress(percent);
                },
            });

            toast.success("Job queued successfully 🚀");
            navigate("/dashboard");
        } catch (err) {
            alert(err.response?.data?.error || "Upload failed");
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    const remaining = stats?.remainingJobs || 0;

    return (
        <div className="space-y-10">

            {/* Quota Display */}
            {stats && (
                <div className="bg-white p-6 rounded-xl shadow-sm">
                    <p className="text-gray-500">
                        You have <span className="font-bold">{remaining}</span> jobs remaining today.
                    </p>
                </div>
            )}

            {/* Drag & Drop Box */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center bg-white hover:border-blue-500 transition cursor-pointer"
                onClick={() => document.getElementById("fileInput").click()}
            >
                <input
                    id="fileInput"
                    type="file"
                    hidden
                    onChange={(e) => setFile(e.target.files[0])}
                />

                <p className="text-lg text-gray-600">
                    Drop file here or click to browse
                </p>

                {file && (
                    <p className="mt-4 text-blue-600 font-medium">
                        Selected: {file.name}
                    </p>
                )}
            </div>

            {/* Conversion Selector */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
                <label className="block text-gray-500 mb-2">
                    Conversion Type
                </label>

                <select
                    value={conversion}
                    onChange={(e) => setConversion(e.target.value)}
                    className="w-full border p-3 rounded-lg"
                >
                    <option value="image->pdf">Image → PDF</option>
                    <option value="pdf->images">PDF → Images</option>
                    <option value="pdf->ocr">PDF → OCR</option>
                </select>
            </div>

            {/* Upload Button */}
            <div className="text-center">
                <button
                    onClick={handleUpload}
                    disabled={!file || remaining === 0 || loading}
                    className={`px-8 py-4 rounded-lg text-white ${remaining === 0
                            ? "bg-gray-400"
                            : "bg-blue-600 hover:bg-blue-700"
                        } transition`}
                >
                    {loading ? "Uploading..." : "Start Conversion"}
                </button>
            </div>

            {/* Progress Bar */}
            {loading && (
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

        </div>
    );
}