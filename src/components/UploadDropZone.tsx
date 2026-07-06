import React, { useState, useRef } from "react";
import { Upload, FolderOpen, Files, FileCode, AlertCircle, RefreshCw } from "lucide-react";
import { UploadedFile } from "../types";

interface Props {
  onFilesUploaded: (files: UploadedFile[]) => void;
  existingFilesCount: number;
}

export default function UploadDropZone({ onFilesUploaded, existingFilesCount }: Props) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Helper: Read a file fully as base64 and standard text if possible
  const processStandardFile = async (file: File, relativePath: string): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const contentBase64 = result.split(",")[1] || "";
        
        // Determine if it is likely a text file (for client previews & markdown helpers)
        const isBinary = 
          file.type.startsWith("image/") ||
          file.type.startsWith("audio/") ||
          file.type.startsWith("video/") ||
          file.type.includes("pdf") ||
          file.type.includes("zip") ||
          file.type.includes("octet-stream") ||
          /\.(png|jpe?g|gif|ico|pdf|zip|tar|gz|mp3|mp4|exe|dll|so|dylib|wasm)$/i.test(file.name);

        if (isBinary) {
          resolve({
            id: Math.random().toString(36).substring(7),
            path: relativePath,
            name: file.name,
            size: file.size,
            content: contentBase64,
            isBinary: true,
          });
        } else {
          // Read text content separately for previews/AI
          const textReader = new FileReader();
          textReader.readAsText(file);
          textReader.onload = () => {
            resolve({
              id: Math.random().toString(36).substring(7),
              path: relativePath,
              name: file.name,
              size: file.size,
              content: contentBase64,
              text: textReader.result as string,
              isBinary: false,
            });
          };
          textReader.onerror = () => {
            // Fallback to empty text
            resolve({
              id: Math.random().toString(36).substring(7),
              path: relativePath,
              name: file.name,
              size: file.size,
              content: contentBase64,
              text: "",
              isBinary: false,
            });
          };
        }
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // HTML5 webkitGetAsEntry recursive directories explorer for Drag-and-Drop
  const traverseDirectoryEntry = async (
    entry: any,
    currentPath = ""
  ): Promise<UploadedFile[]> => {
    const files: UploadedFile[] = [];

    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });
      const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      const parsed = await processStandardFile(file, relativePath);
      files.push(parsed);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries: any[] = await new Promise((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });

      const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      for (const childEntry of entries) {
        const parsedFiles = await traverseDirectoryEntry(childEntry, nextPath);
        files.push(...parsedFiles);
      }
    }
    return files;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setError("");

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    setIsProcessing(true);
    try {
      const filesPromises: Promise<UploadedFile[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          // Check webkitGetAsEntry for folders
          const entry = item.webkitGetAsEntry();
          if (entry) {
            filesPromises.push(traverseDirectoryEntry(entry));
          } else {
            const file = item.getAsFile();
            if (file) {
              const promise = processStandardFile(file, file.name).then((f) => [f]);
              filesPromises.push(promise);
            }
          }
        }
      }

      const results = await Promise.all(filesPromises);
      const flatFiles = results.flat();
      onFilesUploaded(flatFiles);
    } catch (err: any) {
      console.error("Drop processing failed:", err);
      setError("Failed to parse dropped directory or files. Make sure files are accessible.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle standard files input upload
  const handleFilesInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;

    setIsProcessing(true);
    setError("");
    try {
      const promises: Promise<UploadedFile>[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        // Use webkitRelativePath for directories if available, otherwise just file name
        const path = file.webkitRelativePath || file.name;
        promises.push(processStandardFile(file, path));
      }

      const results = await Promise.all(promises);
      onFilesUploaded(results);
    } catch (err) {
      setError("Failed to parse some uploaded files. Ensure they are correct.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFilesSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerFolderSelect = () => {
    folderInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesInput}
        className="hidden"
        id="files-selector"
      />
      
      {/* webkitdirectory configuration allows folder selection explicitly */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...{ webkitdirectory: "", directory: "" }}
        onChange={handleFilesInput}
        className="hidden"
        id="folder-selector"
      />

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center transition-all min-h-[220px] ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
            : "border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-400 hover:border-slate-700"
        }`}
        id="dropzone-container"
      >
        {isProcessing ? (
          <div className="flex flex-col items-center animate-pulse gap-3 text-slate-300">
            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
            <div>
              <p className="font-semibold text-sm">Processing files...</p>
              <p className="text-xs text-slate-500 mt-0.5">Encoding Base64 buffers recursive structure</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 shadow-inner group-hover:scale-105 transition-transform">
              <Upload className="w-6 h-6 text-indigo-400" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-200">
                Drag &amp; drop files or a full folder here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports massive trees, single scripts, source repositories, or bento blueprints
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={triggerFilesSelect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-850 hover:border-slate-700 transition-all select-none"
                id="select-files-btn"
              >
                <Files className="w-3.5 h-3.5" />
                Select Files
              </button>
              <button
                type="button"
                onClick={triggerFolderSelect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-850 hover:border-slate-700 transition-all select-none"
                id="select-folder-btn"
              >
                <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
                Select Folder
              </button>
            </div>
          </div>
        )}

        {existingFilesCount > 0 && !isProcessing && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-xs text-indigo-400 font-medium bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
            <FileCode className="w-3.5 h-3.5" />
            {existingFilesCount} files staged
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
