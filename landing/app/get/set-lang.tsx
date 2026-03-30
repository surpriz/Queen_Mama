"use client";

import { useEffect } from "react";

export default function SetLang() {
  useEffect(() => {
    document.documentElement.lang = "fr";
    return () => {
      document.documentElement.lang = "en";
    };
  }, []);
  return null;
}
