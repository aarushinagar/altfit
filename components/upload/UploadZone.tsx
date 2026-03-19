"use client";

interface UploadZoneProps {
  dragover: boolean;
  setDragover: (v: boolean) => void;
  onFiles: (files: FileList) => void;
  disabled?: boolean;
}

export default function UploadZone({
  dragover,
  setDragover,
  onFiles,
  disabled,
}: UploadZoneProps) {
  return (
    <label
      className={`upload-zone ${dragover ? "dragover" : ""}`}
      style={{ display: "block", cursor: disabled ? "not-allowed" : "pointer", position: "relative" }}
      onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragover(false);
        if (!disabled && e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          // Reset so same file can be re-selected
          e.target.value = "";
        }}
      />
      <div className="upload-zone-inner">
        {/* Camera icon */}
        <div className="upload-camera-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="upload-title">Add to your wardrobe</div>
        <p className="upload-sub">Tap to take a photo or choose from library</p>
        <div className="upload-cta-pill">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ marginRight: 6, flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Photo
        </div>
        <p className="upload-desktop-hint">or drag &amp; drop here</p>
      </div>
    </label>
  );
}
