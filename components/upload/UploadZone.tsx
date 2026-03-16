"use client";

interface UploadZoneProps {
  dragover: boolean;
  setDragover: (v: boolean) => void;
  onFiles: (files: FileList) => void;
}

export default function UploadZone({
  dragover,
  setDragover,
  onFiles,
}: UploadZoneProps) {
  return (
    <label
      className={`upload-zone ${dragover ? "dragover" : ""}`}
      style={{
        display: "block",
        cursor: "pointer",
        position: "relative",
        zIndex: 10,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragover(true);
      }}
      onDragLeave={() => setDragover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragover(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
        }}
      />
      <div className="upload-icon">↑</div>
      <div className="upload-title">Drop your photo here</div>
      <p className="upload-sub">
        Full outfit or single piece — you decide what to save
      </p>
    </label>
  );
}
