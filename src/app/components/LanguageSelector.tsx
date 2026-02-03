"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  currentLanguage: "en" | "sv";
  orgSlug: string;
  adminToken: string;
};

export function LanguageSelector({ currentLanguage, orgSlug, adminToken }: Props) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [language, setLanguage] = useState(currentLanguage);

  const handleLanguageChange = async (newLang: "en" | "sv") => {
    if (newLang === language || isUpdating) return;

    setIsUpdating(true);
    try {
      const baseUrl = window.location.origin;
      const url = new URL(`${baseUrl}/api/admin/settings`);
      url.searchParams.set("orgSlug", orgSlug);

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ language: newLang }),
      });

      if (response.ok) {
        setLanguage(newLang);
        router.refresh();
      } else {
        console.error("Failed to update language");
      }
    } catch (error) {
      console.error("Error updating language:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => handleLanguageChange("en")}
        disabled={isUpdating}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          language === "en"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        EN
      </button>
      <button
        onClick={() => handleLanguageChange("sv")}
        disabled={isUpdating}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          language === "sv"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        SV
      </button>
    </div>
  );
}
