import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/device-auth";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000;

// Common header aliases for auto-detection
const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["firstname", "first_name", "first name", "prénom", "prenom", "given name", "givenname"],
  lastName: ["lastname", "last_name", "last name", "nom", "nom de famille", "surname", "family name", "familyname"],
  email: ["email", "e-mail", "mail", "email address", "courriel", "adresse email"],
  company: ["company", "société", "societe", "organization", "organisation", "entreprise", "company name"],
  role: ["role", "titre", "title", "position", "poste", "job title", "job_title", "fonction"],
};

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.slice(7);
    try {
      const tokenPayload = await verifyAccessToken(accessToken);
      return tokenPayload.sub;
    } catch {
      // Fall through to session auth
    }
  }
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }
  return null;
}

function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (aliases.includes(normalizedHeaders[i])) {
        mapping[field] = headers[i];
        break;
      }
    }
  }

  return mapping;
}

function parseRow(
  row: Record<string, string>,
  mapping: Record<string, string>
): { firstName: string; lastName?: string; email?: string; company?: string; role?: string } | null {
  const firstName = (row[mapping.firstName] || "").trim();
  if (!firstName) return null;

  const lastName = mapping.lastName ? (row[mapping.lastName] || "").trim() || undefined : undefined;
  const email = mapping.email ? (row[mapping.email] || "").trim() || undefined : undefined;
  const company = mapping.company ? (row[mapping.company] || "").trim() || undefined : undefined;
  const role = mapping.role ? (row[mapping.role] || "").trim() || undefined : undefined;

  // Basic email validation if present
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { firstName, lastName, company, role };
  }

  return { firstName, lastName, email, company, role };
}

/**
 * POST /api/contacts/import
 * Import contacts from CSV or Excel file
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "invalid_content_type", message: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mappingOverride = formData.get("mapping") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "missing_file", message: "No file uploaded" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "file_too_large", message: "File must be under 5MB" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    let rows: Record<string, string>[] = [];
    let headers: string[] = [];

    if (fileName.endsWith(".csv")) {
      // Parse CSV
      const text = await file.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });

      if (result.errors.length > 0 && result.data.length === 0) {
        return NextResponse.json(
          { error: "parse_error", message: "Failed to parse CSV file", details: result.errors.slice(0, 5) },
          { status: 400 }
        );
      }

      headers = result.meta.fields || [];
      rows = result.data;
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // Parse Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json(
          { error: "empty_file", message: "Excel file has no sheets" },
          { status: 400 }
        );
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

      if (jsonData.length === 0) {
        return NextResponse.json(
          { error: "empty_file", message: "File contains no data" },
          { status: 400 }
        );
      }

      headers = Object.keys(jsonData[0]);
      rows = jsonData.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))
      );
    } else {
      return NextResponse.json(
        { error: "unsupported_format", message: "Supported formats: .csv, .xlsx, .xls" },
        { status: 400 }
      );
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: "too_many_rows", message: `Maximum ${MAX_ROWS} rows allowed, file has ${rows.length}` },
        { status: 400 }
      );
    }

    // Detect or use provided column mapping
    let mapping: Record<string, string>;
    if (mappingOverride) {
      try {
        mapping = JSON.parse(mappingOverride);
      } catch {
        return NextResponse.json(
          { error: "invalid_mapping", message: "Column mapping must be valid JSON" },
          { status: 400 }
        );
      }
    } else {
      mapping = detectColumnMapping(headers);
    }

    if (!mapping.firstName) {
      return NextResponse.json(
        {
          error: "missing_mapping",
          message: "Could not detect a column for first name. Please provide a column mapping.",
          detectedHeaders: headers,
        },
        { status: 400 }
      );
    }

    // Fetch existing contact emails for dedup
    const existingContacts = await prisma.contact.findMany({
      where: { userId },
      select: { email: true },
    });
    const existingEmails = new Set(
      existingContacts.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[]
    );

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = parseRow(rows[i], mapping);

      if (!parsed) {
        errors.push({ row: i + 2, reason: "Missing first name" });
        continue;
      }

      if (parsed.firstName.length > 100) {
        errors.push({ row: i + 2, reason: "First name too long (max 100)" });
        continue;
      }

      // Dedup by email
      if (parsed.email && existingEmails.has(parsed.email.toLowerCase())) {
        skipped++;
        continue;
      }

      try {
        await prisma.contact.create({
          data: {
            userId,
            firstName: parsed.firstName,
            lastName: parsed.lastName || null,
            email: parsed.email || null,
            company: parsed.company || null,
            role: parsed.role || null,
          },
        });

        if (parsed.email) {
          existingEmails.add(parsed.email.toLowerCase());
        }
        imported++;
      } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") {
          skipped++;
        } else {
          errors.push({ row: i + 2, reason: "Database error" });
        }
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
      mapping,
      headers,
    });
  } catch (error) {
    console.error("Contact import error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Import failed" },
      { status: 500 }
    );
  }
}
