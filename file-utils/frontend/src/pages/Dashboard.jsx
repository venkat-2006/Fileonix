import { useEffect, useState } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {

  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const NORMAL_LIMIT = 10;
  const OCR_LIMIT = 5;

  /* ---------------- FETCH DATA ---------------- */

  const fetchData = async () => {
    try {

      const statsRes = await api.get("/users/me/stats");
      const jobsRes = await api.get("/jobs/me");

      setStats(statsRes.data);
      setJobs(jobsRes.data || []);

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- AUTO REFRESH ---------------- */

  useEffect(() => {

    fetchData();

    const interval = setInterval(fetchData, 15000);

    return () => clearInterval(interval);

  }, []);

  /* ---------------- DOWNLOAD ---------------- */

  const handleDownload = async (jobId) => {

    try {

      const response = await api.get(`/jobs/${jobId}/zip`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));

      const link = document.createElement("a");

      link.href = url;
      link.download = `results-${jobId}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {

      alert("Download failed (file may have expired)");

    }

  };

  /* ---------------- LOADING ---------------- */

  if (loading) {

    return (
      <div className="space-y-6 animate-pulse">

        <div className="h-24 bg-gray-200 rounded-xl"></div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="h-24 bg-gray-200 rounded-xl"></div>
          <div className="h-24 bg-gray-200 rounded-xl"></div>
          <div className="h-24 bg-gray-200 rounded-xl"></div>
        </div>

        <div className="h-64 bg-gray-200 rounded-xl"></div>

      </div>
    );

  }

  /* ---------------- DAILY LIMITS ---------------- */

  const jobsToday = stats?.jobsToday ?? 0;
  const ocrToday = stats?.ocrToday ?? 0;

  const normalJobsToday = Math.max(jobsToday - ocrToday, 0);

  const normalLeft = Math.max(NORMAL_LIMIT - normalJobsToday, 0);
  const ocrLeft = Math.max(OCR_LIMIT - ocrToday, 0);

  const uploadDisabled = normalLeft === 0 && ocrLeft === 0;

  return (

    <div className="space-y-10">

      {/* Lifetime Usage */}

      <div className="bg-white p-6 rounded-xl shadow-sm border">

        <h2 className="text-lg text-gray-500 mb-2">
          Lifetime Usage
        </h2>

        <p className="text-3xl font-bold text-blue-600">
          {stats?.jobsTotal ?? 0}
        </p>

        <p className="text-sm text-gray-400">
          Total jobs processed
        </p>

      </div>

      {/* Daily Stats */}

      <div className="grid md:grid-cols-3 gap-6">

        <StatCard title="Total Jobs Used Today" value={jobsToday} />

        <StatCard
          title="Normal Jobs Left"
          value={normalLeft}
          subtitle={`Limit ${NORMAL_LIMIT}`}
        />

        <StatCard
          title="OCR Jobs Left"
          value={ocrLeft}
          subtitle={`Limit ${OCR_LIMIT}`}
        />

      </div>

      {/* Upload Button */}

      <div className="text-center">

        <button
          onClick={() => navigate("/upload")}
          disabled={uploadDisabled}
          className={`px-8 py-4 rounded-lg text-lg transition ${
            uploadDisabled
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Upload File
        </button>

      </div>

      {/* Job History */}

      <div>

        <h2 className="text-2xl font-bold mb-4">
          Recent Jobs
        </h2>

        {jobs.length === 0
          ? <EmptyState />
          : <JobTable jobs={jobs} onDownload={handleDownload} />}

      </div>

    </div>

  );

}

/* ---------------- TIME FORMATTER ---------------- */
function formatTime(utcString) {

  // Force UTC parsing
  const utcDate = new Date(utcString + "Z");

  const now = new Date();

  const diffMs = now.getTime() - utcDate.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return utcDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });

}
/* ---------------- STAT CARD ---------------- */

function StatCard({ title, value, subtitle }) {

  return (

    <div className="bg-white p-6 rounded-xl shadow-sm border">

      <h3 className="text-gray-500 mb-2">{title}</h3>

      <p className="text-3xl font-bold text-blue-600">{value}</p>

      {subtitle && (
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      )}

    </div>

  );

}

/* ---------------- JOB TABLE ---------------- */

function JobTable({ jobs, onDownload }) {

  return (

    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

      <table className="w-full text-left">

        <thead className="bg-slate-100 text-gray-600 text-sm">
          <tr>
            <th className="p-4">Type</th>
            <th className="p-4">Status</th>
            <th className="p-4">Created</th>
            <th className="p-4">Download</th>
          </tr>
        </thead>

        <tbody>

          {jobs.map(job => {

            // const createdTime = new Date(job.created_at);
            // const now = new Date();

            // const ageMs = now - createdTime;

            // const expired = ageMs > 2 * 60 * 60 * 1000;
            const DOWNLOAD_TTL = 2 * 60 * 60 * 1000;
            const created = new Date(job.created_at + "Z").getTime();
            const expired = Date.now() - created > DOWNLOAD_TTL;

            return (

              <tr key={job.id} className="border-t hover:bg-gray-50">

                <td className="p-4 font-medium">
                  {job.conversion_type}
                </td>

                <td className="p-4">
                  <StatusBadge status={job.status} />
                </td>

                <td
                  className="p-4 text-sm text-gray-600"
                  title={new Date(job.created_at)
                    .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                >
                  {formatTime(job.created_at)}
                </td>

                <td className="p-4">

                  {job.status === "completed" && !expired
                    ? (
                      <button
                        onClick={() => onDownload(job.id)}
                        className="text-blue-600 hover:underline"
                      >
                        Download
                      </button>
                    )
                    : expired
                      ? <span className="text-gray-400 text-sm">Expired</span>
                      : "-"
                  }

                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

    </div>

  );

}

/* ---------------- STATUS BADGE ---------------- */

function StatusBadge({ status }) {

  const colors = {
    completed: "bg-green-100 text-green-700",
    processing: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    queued: "bg-blue-100 text-blue-700",
  };

  return (

    <span className={`px-3 py-1 text-sm rounded-full font-medium ${
      colors[status] || "bg-gray-100 text-gray-600"
    }`}>
      {status}
    </span>

  );

}

/* ---------------- EMPTY STATE ---------------- */

function EmptyState() {

  return (

    <div className="bg-white rounded-xl shadow-sm border p-10 text-center text-gray-500">

      <p className="text-lg">No jobs yet 🚀</p>

      <p className="text-sm mt-2">
        Upload your first file to get started.
      </p>

    </div>

  );

}