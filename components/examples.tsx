/**
 * Example: Login Component
 * Shows how to use the useAuth hook for authentication
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks";

export function LoginExample() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      console.log("Login successful! Redirect to dashboard");
      // Redirect to dashboard here
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}

/**
 * Example: Wardrobe List Component
 * Shows how to use the useWardrobe hook to fetch and display items
 */

import { useEffect } from "react";
import { useWardrobe } from "@/lib/hooks";

export function WardrobeListExample() {
  const { items, isLoading, error, loadItems } = useWardrobe();

  // Load items on mount
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (isLoading) return <p>Loading wardrobe...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>My Wardrobe ({items.length} items)</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #ccc",
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{
                  width: "100%",
                  height: "200px",
                  objectFit: "cover",
                  borderRadius: "4px",
                }}
              />
            )}
            <h3>{item.name}</h3>
            <p>{item.category}</p>
            {item.colors && <p>Colors: {item.colors.join(", ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example: Upload Image Component
 * Shows how to use the useUpload hook for file uploads
 */

import { useUpload } from "@/lib/hooks";

export function UploadImageExample() {
  const { uploadImage, isLoading, progress, error } = useUpload();
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    const result = await uploadImage(file);
    if (result) {
      console.log("Upload successful! URL:", result.url);
      // Use result.url to display the image
    }
  };

  return (
    <div>
      <h3>Upload Image</h3>
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{
            maxWidth: "200px",
            maxHeight: "200px",
            marginBottom: "16px",
          }}
        />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isLoading}
      />
      {isLoading && <p>Uploading... {progress}%</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
    </div>
  );
}

/**
 * Example: Generate Outfit Component
 * Shows how to use the useOutfit hook to generate and display outfits
 */

import { useOutfit } from "@/lib/hooks";

export function GenerateOutfitExample() {
  const { generateOutfit, isLoading, error, outfits } = useOutfit();
  const [occasion, setOccasion] = useState("casual");

  const handleGenerate = async () => {
    const outfit = await generateOutfit(occasion);
    if (outfit) {
      console.log("Outfit generated with", outfit.items?.length || 0, "items");
    }
  };

  return (
    <div>
      <h2>Generate Outfit</h2>
      <select
        value={occasion}
        onChange={(e) => setOccasion(e.target.value)}
        disabled={isLoading}
      >
        <option value="casual">Casual</option>
        <option value="work">Work</option>
        <option value="formal">Formal</option>
        <option value="party">Party</option>
      </select>
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate Outfit"}
      </button>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {outfits.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h3>Last Generated Outfit</h3>
          <p style={{ marginTop: "12px" }}>
            <strong>Occasion:</strong> {outfits[0].occasion || "Not specified"}{" "}
            <br />
            <strong>Scores:</strong> Balance: {outfits[0].scoreBalance}, Color:{" "}
            {outfits[0].scoreColor}
          </p>
          <div>
            <strong>Items ({outfits[0].items?.length || 0}):</strong>
            {outfits[0].items?.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "8px",
                  marginTop: "4px",
                  border: "1px solid #ddd",
                }}
              >
                <p>
                  <strong>ID:</strong> {item.wardrobeItemId} |{" "}
                  <strong>Role:</strong> {item.role || "unassigned"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
