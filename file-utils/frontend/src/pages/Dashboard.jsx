import { useEffect, useState } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
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

    fetchData();
  }, []);

  const handleDownload = async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/zip`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "results.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed");
    }
  };
if (loading) {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-24 bg-gray-200 rounded-xl"></div>
      <div className="h-24 bg-gray-200 rounded-xl"></div>
      <div className="h-64 bg-gray-200 rounded-xl"></div>
    </div>
  );
}
  return (
    <div className="space-y-10">

      {/* Lifetime Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
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

      {/* Daily Usage */}
      <div className="grid md:grid-cols-3 gap-6">
        <UsageCard
          title="Jobs Today"
          used={stats?.jobsToday ?? 0}
          total={10}
        />
        <UsageCard
          title="OCR Today"
          used={stats?.ocrToday ?? 0}
          total={5}
        />
        <UsageCard
          title="Remaining Jobs"
          used={stats?.remainingJobs ?? 0}
          total={10}
          reverse
        />
      </div>

      {/* Upload CTA */}
      <div className="text-center">
        <button
          onClick={() => navigate("/upload")}
          className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-blue-700 transition"
        >
          Upload File
        </button>
      </div>

      {/* Job History */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Jobs</h2>

        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <JobTable jobs={jobs} onDownload={handleDownload} />
        )}
      </div>
    </div>
  );
}

function UsageCard({ title, used, total, reverse = false }) {
  const percentage =
    total > 0 ? Math.min((used / total) * 100, 100) : 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-gray-500 mb-2">{title}</h3>

      <p className="text-2xl font-bold mb-4">
        {used} / {total}
      </p>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${
            reverse ? "bg-green-500" : "bg-blue-600"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function JobTable({ jobs, onDownload }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
          {jobs.map((job) => (
            <tr key={job.id} className="border-t">
              <td className="p-4">{job.conversion_type}</td>
              <td className="p-4">
                <StatusBadge status={job.status} />
              </td>
              <td className="p-4">
                {new Date(job.created_at).toLocaleString()}
              </td>
              <td className="p-4">
                {job.status === "completed" ? (
                  <button
                    onClick={() => onDownload(job.id)}
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </button>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    completed: "bg-green-100 text-green-700",
    processing: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    queued: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`px-3 py-1 text-sm rounded-full ${
        colors[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500">
      <p className="text-lg">No jobs yet 🚀</p>
      <p className="text-sm mt-2">
        Upload your first file to get started.
      </p>
    </div>
  );
}