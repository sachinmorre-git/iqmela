"use client";

import { useState, useRef } from "react";
import { 
  X, Code2, FileText, CircleDot, CheckSquare, Paperclip, 
  ChevronRight, Loader2, Plus, Trash2, UploadCloud
} from "lucide-react";
import { createInterviewQuestion } from "./actions";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPES = [
  { id: "PLAIN_TEXT", label: "Plain Text", icon: FileText, desc: "A simple conversational or behavioral question." },
  { id: "CODING", label: "Coding / Algorithm", icon: Code2, desc: "Requires candidates to write and run code." },
  { id: "MCQ_SINGLE", label: "Multiple Choice", icon: CircleDot, desc: "Candidates pick one correct option." },
  { id: "MCQ_MULTI", label: "Multiple Select", icon: CheckSquare, desc: "Candidates can pick multiple correct options." },
  { id: "FILE_BASED", label: "File Based Scenario", icon: Paperclip, desc: "Provide an Excel, CSV, or Image context." }
];

export function QuestionBuilderModal({ isOpen, onClose }: ModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [type, setType] = useState("PLAIN_TEXT");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  
  // Coding
  const [language, setLanguage] = useState("javascript");
  const [starterCode, setStarterCode] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");

  // MCQ
  const [options, setOptions] = useState([{ id: "A", text: "", isCorrect: false }, { id: "B", text: "", isCorrect: false }]);
  const [explanation, setExplanation] = useState("");

  // File
  const [file, setFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1 && !type) return;
    if (step === 2 && (!title || !description)) return;
    setStep(s => s + 1);
  };

  const handleAddOption = () => {
    const nextId = String.fromCharCode(65 + options.length); // A, B, C...
    setOptions([...options, { id: nextId, text: "", isCorrect: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    // Re-assign letters
    setOptions(newOptions.map((o, i) => ({ ...o, id: String.fromCharCode(65 + i) })));
  };

  const updateOption = (index: number, field: string, val: any) => {
    const newOptions = [...options];
    
    if (field === "isCorrect" && type === "MCQ_SINGLE") {
      newOptions.forEach(o => o.isCorrect = false);
    }
    
    (newOptions[index] as any)[field] = val;
    setOptions(newOptions);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let attachmentUrl = "";
      let attachmentName = "";

      if (type === "FILE_BASED" && file) {
        setUploadingFile(true);
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Failed to upload file");
        const json = await res.json();
        attachmentUrl = json.url;
        attachmentName = file.name;
        setUploadingFile(false);
      }

      await createInterviewQuestion({
        type, title, description, difficulty, category,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        language, starterCode, sampleInput, expectedOutput,
        options: (type === "MCQ_SINGLE" || type === "MCQ_MULTI") ? options : undefined,
        explanation,
        attachmentUrl, attachmentName
      });

      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save question");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-zinc-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Create Question</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Build a custom scenario-based question</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 dark:bg-zinc-800 w-full">
          <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto max-h-[70vh]">
          
          {/* STEP 1: Select Format */}
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-300">What type of question is this?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const isSelected = type === t.id;
                  return (
                    <button key={t.id} onClick={() => setType(t.id)}
                      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                        isSelected 
                          ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10 ring-1 ring-rose-500/20" 
                          : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? "text-rose-700 dark:text-rose-300" : "text-gray-900 dark:text-white"}`}>
                          {t.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{t.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Core Details */}
          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Question Title</label>
                   <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Optimize React Re-renders" 
                     className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400" />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Difficulty</label>
                     <select value={difficulty} onChange={e => setDifficulty(e.target.value)} 
                       className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white">
                       <option value="EASY">Easy</option>
                       <option value="MEDIUM">Medium</option>
                       <option value="HARD">Hard</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Domain</label>
                     <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Azure, SQL" 
                       className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400" />
                   </div>
                 </div>
               </div>

               <div>
                 <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Scenario / Description</label>
                 <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the problem, scenario, or architecture..." rows={5}
                   className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400 resize-none" />
               </div>

               <div>
                 <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Tags (comma separated)</label>
                 <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. system-design, cloud, databases" 
                   className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400" />
               </div>
            </div>
          )}

          {/* STEP 3: Format-Specific Details */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {type === "CODING" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Default Language</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)} 
                       className="w-full max-w-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white">
                       <option value="javascript">JavaScript / Node.js</option>
                       <option value="python">Python 3</option>
                       <option value="java">Java</option>
                       <option value="cpp">C++</option>
                     </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Starter Code Template</label>
                    <textarea value={starterCode} onChange={e => setStarterCode(e.target.value)} placeholder="function solve(arr) {\n  // your code here\n}" rows={4}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Sample Input (stdin)</label>
                      <textarea value={sampleInput} onChange={e => setSampleInput(e.target.value)} placeholder="5\n1 2 3 4 5" rows={3}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400 resize-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Expected Output (stdout)</label>
                      <textarea value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)} placeholder="15" rows={3}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400 resize-none" />
                    </div>
                  </div>
                </div>
              )}

              {(type === "MCQ_SINGLE" || type === "MCQ_MULTI") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Options</label>
                    <button onClick={handleAddOption} className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 hover:underline">
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {options.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-3">
                        <div className="w-8 flex justify-center">
                          <input 
                            type={type === "MCQ_SINGLE" ? "radio" : "checkbox"} 
                            name="correctOption"
                            checked={opt.isCorrect} 
                            onChange={e => updateOption(idx, "isCorrect", e.target.checked)}
                            className="w-4 h-4 text-rose-600 focus:ring-rose-500 dark:bg-zinc-800 dark:border-zinc-700" 
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-400 w-4">{opt.id}.</span>
                        <input value={opt.text} onChange={e => updateOption(idx, "text", e.target.value)} placeholder={`Option ${opt.id}`} 
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white" />
                        <button onClick={() => handleRemoveOption(idx)} disabled={options.length <= 2} className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Explanation (Optional)</label>
                    <textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explain why this is the correct answer..." rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-white placeholder:text-gray-400 resize-none" />
                  </div>
                </div>
              )}

              {type === "FILE_BASED" && (
                <div className="space-y-4">
                  <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Attach Context File</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition cursor-pointer"
                  >
                    <UploadCloud className="w-8 h-8 text-rose-400 mb-3" />
                    <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                      {file ? file.name : "Click to upload an Image, CSV, or Excel file"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                      {file ? "Click to replace" : "Supports .png, .jpg, .csv, .xlsx (Max 5MB)"}
                    </p>
                    <input 
                      type="file" ref={fileInputRef} className="hidden"
                      accept=".png,.jpg,.jpeg,.csv,.xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setFile(e.target.files[0]);
                      }}
                    />
                  </div>
                </div>
              )}

              {type === "PLAIN_TEXT" && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-rose-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ready to Save</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm mt-1">
                    Plain text questions do not require any additional configuration. You can save it now.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/40 flex justify-between items-center">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-white transition">
              Back
            </button>
          ) : <div></div>}
          
          {step < 3 ? (
            <button 
              onClick={handleNext}
              disabled={step === 1 ? !type : (!title || !description)}
              className="px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold flex items-center gap-2 hover:bg-black dark:hover:bg-gray-100 transition disabled:opacity-50"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleSave}
              disabled={loading || uploadingFile}
              className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-rose-700 transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                "Save Question"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
