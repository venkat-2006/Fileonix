import { useState, useEffect } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Upload() {

  const [files,setFiles] = useState([]);
  const [conversion,setConversion] = useState("image->pdf");
  const [stats,setStats] = useState(null);
  const [progress,setProgress] = useState(0);
  const [loading,setLoading] = useState(false);

  const navigate = useNavigate();

  const NORMAL_LIMIT = 10;
  const OCR_LIMIT = 5;

  useEffect(() => {

    const fetchStats = async () => {
      const res = await api.get("/users/me/stats");
      setStats(res.data);
    };

    fetchStats();

  },[]);

  const jobsToday = stats?.jobsToday ?? 0;
  const ocrToday = stats?.ocrToday ?? 0;

  const normalJobsToday = Math.max(jobsToday - ocrToday,0);

  const normalLeft = Math.max(NORMAL_LIMIT - normalJobsToday,0);
  const ocrLeft = Math.max(OCR_LIMIT - ocrToday,0);

  const OCR_TYPES = [
    "pdf->ocr",
    "image->txt",
    "image->searchable-pdf",
    "pdf->searchable-pdf"
  ];

  const isOCR = OCR_TYPES.includes(conversion);

  const uploadDisabled =
    (files.length === 0 && conversion !== "file->expiry") ||
    (isOCR ? ocrLeft === 0 : normalLeft === 0) ||
    loading;

  const handleUpload = async () => {

    if(files.length === 0 && conversion !== "file->expiry") return;

    const formData = new FormData();

    files.forEach(f => formData.append("files",f));

    formData.append("conversionType",conversion);

    try {

      setLoading(true);

      await api.post("/upload",formData,{
        onUploadProgress:(event)=>{
          const percent = Math.round((event.loaded*100)/event.total);
          setProgress(percent);
        }
      });

      toast.success("Job queued successfully 🚀");

      navigate("/dashboard");

    } catch(err){

      toast.error(err.response?.data?.error || "Upload failed");

    } finally{

      setLoading(false);
      setProgress(0);

    }

  };

  const sections = [

    {
      title:"Image Tools",
      tools:[
        ["image->pdf","Image → PDF"],
        ["image->docx","Image → DOCX"],
        ["image->pptx","Image → PPTX"]
      ]
    },

    {
      title:"OCR Tools (Limited)",
      tools:[
        ["image->txt","Image → Text (OCR)"],
        ["image->searchable-pdf","Image → Searchable PDF"],
        ["pdf->ocr","PDF → OCR"],
        ["pdf->searchable-pdf","PDF → Searchable PDF"]
      ]
    },

    {
      title:"Text Tools",
      tools:[
        ["txt->pdf","Text → PDF"],
        ["txt->docx","Text → DOCX"]
      ]
    },

    {
      title:"PDF Conversion",
      tools:[
        ["pdf->txt","PDF → Text"],
        ["pdf->docx","PDF → DOCX"],
        ["pdf->html","PDF → HTML"],
        ["pdf->render-images","PDF → Images"],
        ["pdf->extract-images","Extract Images"]
      ]
    },

    {
      title:"PDF Editing",
      tools:[
        ["pdf->merge","Merge PDFs"],
        ["pdf->split","Split PDF"],
        ["pdf->compress","Compress PDF"],
        ["pdf->rotate","Rotate PDF"],
        ["pdf->reorder","Reorder Pages"],
        ["pdf->delete","Delete Pages"],
        ["pdf->extract","Extract Pages"]
      ]
    },

    {
      title:"PDF Security",
      tools:[
        ["pdf->protect","Protect PDF"],
        ["pdf->unlock","Unlock PDF"],
        ["pdf->watermark","Add Watermark"]
      ]
    },

    {
      title:"AI / NLP Tools",
      tools:[
        ["pdf->keypoints","Extract Key Points"],
        ["pdf->keywords","Extract Keywords"],
        ["pdf->similarity","Compare PDFs"]
      ]
    },

    {
      title:"PDF Utilities",
      tools:[
        ["pdf->repair","Repair PDF"],
        ["pdf->grayscale","Grayscale PDF"],
        ["pdf->flatten","Flatten PDF"],
        ["pdf->metadata","Extract Metadata"],
        ["pdf->remove-blank","Remove Blank Pages"]
      ]
    },

    {
      title:"System Tools",
      tools:[
        ["file->expiry","Self-Destruct File"]
      ]
    }

  ];

  return(

    <div className="space-y-10">

      {stats && (

        <div className="grid md:grid-cols-2 gap-6">

          <QuotaCard title="Normal Jobs Left" value={normalLeft} limit={NORMAL_LIMIT}/>

          <QuotaCard title="OCR Jobs Left" value={ocrLeft} limit={OCR_LIMIT}/>

        </div>

      )}

      <div className="flex gap-6">

        <div
          className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-white hover:border-blue-500 transition cursor-pointer"
          onClick={()=>document.getElementById("fileInput").click()}
        >

          <input
            id="fileInput"
            type="file"
            multiple
            hidden
            onChange={(e)=>setFiles(Array.from(e.target.files))}
          />

          <p className="text-lg text-gray-600">
            Drop files here or click to browse
          </p>

          {files.length>0 && (

            <div className="mt-4 text-blue-600 font-medium">

              {files.map(f=>(
                <p key={f.name}>{f.name}</p>
              ))}

            </div>

          )}

        </div>

        <button
          onClick={handleUpload}
          disabled={uploadDisabled}
          className={`px-10 py-6 rounded-xl text-white text-lg transition ${
            uploadDisabled
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>

      </div>

      {sections.map(section => (

        <div key={section.title} className="bg-white p-6 rounded-xl shadow-sm border">

          <h2 className="text-xl font-semibold mb-4">
            {section.title}
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            {section.tools.map(([key,label])=>(
              <button
                key={key}
                onClick={()=>setConversion(key)}
                className={`p-4 rounded-lg border text-left transition ${
                  conversion === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}

          </div>

        </div>

      ))}

      {loading && (

        <div className="w-full bg-gray-200 rounded-full h-3">

          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{width:`${progress}%`}}
          />

        </div>

      )}

    </div>

  );

}

function QuotaCard({title,value,limit}){

  return(

    <div className="bg-white p-6 rounded-xl shadow-sm border">

      <h3 className="text-gray-500 mb-2">{title}</h3>

      <p className="text-3xl font-bold text-blue-600">{value}</p>

      <p className="text-sm text-gray-400">Limit {limit}</p>

    </div>

  );

}