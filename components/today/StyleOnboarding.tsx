"use client";

import { useState } from "react";
import { Box, Button, Typography, Chip, TextField, CircularProgress } from "@mui/material";
import { getAuthToken } from "@/lib/utils/authUtils";

interface StyleOnboardingProps {
    onComplete: () => void;
}

const AESTHETICS = [
    "Minimal", "Editorial", "Streetwear", "Feminine", "Classic",
    "Maximalist", "Boho", "Athleisure", "Preppy", "Y2K",
];

const OCCASIONS = [
    "Work / Office", "Casual outings", "Events & parties",
    "Travel", "Dates", "Gym / active", "Lounging at home",
];

export default function StyleOnboarding({ onComplete }: StyleOnboardingProps) {
    const [step, setStep] = useState(0);
    const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>([]);
    const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
    const [avoidText, setAvoidText] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function toggleChip(value: string, list: string[], setter: (v: string[]) => void) {
        setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
    }

    async function handleSubmit() {
        setSaving(true);
        setError(null);
        try {
            const token = getAuthToken();
            const response = await fetch("/api/style-profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify({
                    preferredAesthetics: selectedAesthetics,
                    occasions: selectedOccasions,
                    avoidCombinations: avoidText
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to save style profile");
            }

            onComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSaving(false);
        }
    }

    const steps = [
        {
            label: "What's your go-to aesthetic?",
            sub: "Pick as many as feel like you",
            content: (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                    {AESTHETICS.map((a) => (
                        <Chip
                            key={a}
                            label={a}
                            onClick={() => toggleChip(a, selectedAesthetics, setSelectedAesthetics)}
                            variant={selectedAesthetics.includes(a) ? "filled" : "outlined"}
                            sx={{
                                cursor: "pointer",
                                fontWeight: selectedAesthetics.includes(a) ? 700 : 400,
                                bgcolor: selectedAesthetics.includes(a) ? "var(--sage)" : "transparent",
                                color: selectedAesthetics.includes(a) ? "#fff" : "inherit",
                                borderColor: "var(--sage)",
                                "&:hover": { bgcolor: "var(--sage)", color: "#fff" },
                            }}
                        />
                    ))}
                </Box>
            ),
        },
        {
            label: "Where do you mostly dress for?",
            sub: "This helps curate the right outfit vibe",
            content: (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                    {OCCASIONS.map((o) => (
                        <Chip
                            key={o}
                            label={o}
                            onClick={() => toggleChip(o, selectedOccasions, setSelectedOccasions)}
                            variant={selectedOccasions.includes(o) ? "filled" : "outlined"}
                            sx={{
                                cursor: "pointer",
                                fontWeight: selectedOccasions.includes(o) ? 700 : 400,
                                bgcolor: selectedOccasions.includes(o) ? "var(--sage)" : "transparent",
                                color: selectedOccasions.includes(o) ? "#fff" : "inherit",
                                borderColor: "var(--sage)",
                                "&:hover": { bgcolor: "var(--sage)", color: "#fff" },
                            }}
                        />
                    ))}
                </Box>
            ),
        },
        {
            label: "Anything you'd rather never wear together?",
            sub: "Optional — e.g. all black, heavy layering, loud prints",
            content: (
                <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="e.g. all black, matching sets, oversized tops with wide-leg pants"
                    value={avoidText}
                    onChange={(e) => setAvoidText(e.target.value)}
                    sx={{ mt: 2 }}
                />
            ),
        },
    ];

    const current = steps[step];
    const isLast = step === steps.length - 1;

    return (
        // Backdrop
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(4px)",
            }}
        >
            {/* Modal card */}
            <Box
                sx={{
                    bgcolor: "var(--cream)",
                    borderRadius: 3,
                    p: { xs: 3, sm: 4 },
                    maxWidth: 480,
                    width: "calc(100% - 32px)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
                }}
            >
                {/* Step indicator */}
                <Box sx={{ display: "flex", gap: 0.75, mb: 3 }}>
                    {steps.map((_, i) => (
                        <Box
                            key={i}
                            sx={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                bgcolor: i <= step ? "var(--sage)" : "var(--border)",
                                transition: "background 0.3s",
                            }}
                        />
                    ))}
                </Box>

                <Typography
                    variant="h6"
                    sx={{ fontFamily: "var(--font-serif)", fontWeight: 700, mb: 0.5, lineHeight: 1.3 }}
                >
                    {current.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {current.sub}
                </Typography>

                {current.content}

                {error && (
                    <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                        {error}
                    </Typography>
                )}

                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4, gap: 1.5 }}>
                    {step > 0 ? (
                        <Button
                            variant="outlined"
                            onClick={() => setStep((s) => s - 1)}
                            disabled={saving}
                            sx={{ flex: 1 }}
                        >
                            Back
                        </Button>
                    ) : (
                        <Box sx={{ flex: 1 }} />
                    )}

                    {isLast ? (
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={saving}
                            sx={{
                                flex: 1,
                                bgcolor: "var(--sage)",
                                "&:hover": { bgcolor: "var(--sage-dark, var(--sage))" },
                            }}
                        >
                            {saving ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Done — show my looks"}
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={() => setStep((s) => s + 1)}
                            sx={{
                                flex: 1,
                                bgcolor: "var(--sage)",
                                "&:hover": { bgcolor: "var(--sage-dark, var(--sage))" },
                            }}
                        >
                            Next
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
