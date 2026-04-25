"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface CsvUploadProps {
  onFileAccepted: (file: File, headers: string[]) => void;
}

export default function CsvUpload({ onFileAccepted }: CsvUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      const file = accepted[0];
      if (!file) return;

      if (!file.name.endsWith(".csv")) {
        setError("Please upload a .csv file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const firstLine = text.split("\n")[0];
        const headers = firstLine
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));
        if (headers.length < 2) {
          setError("CSV must have at least 2 columns");
          return;
        }
        onFileAccepted(file, headers);
      };
      reader.readAsText(file);
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition ${
          isDragActive
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50"
        }`}
      >
        <input {...getInputProps()} />
        <svg
          className="mb-4 h-12 w-12 text-[var(--color-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-lg font-medium">
          {isDragActive
            ? "Drop your CSV here..."
            : "Drag & drop a CSV file, or click to browse"}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Loan applications, hiring candidates, or any decision dataset
        </p>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
