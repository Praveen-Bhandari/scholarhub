import type { Metadata } from "next";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import { ApiError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { CertificateData } from "@/lib/types";

export const metadata: Metadata = { title: "Certificate" };

// SSR: certificate asli hai ya nahi, ye har baar taaza server par dekhte hain
export const dynamic = "force-dynamic";

async function load(id: string): Promise<CertificateData | null> {
  try {
    const d = await serverFetch<{ valid: boolean; certificate: CertificateData }>(
      `/certificates/${encodeURIComponent(id)}`
    );
    return d.certificate;
  } catch (e) {
    // nahi mila ya format galat: dono "valid nahi" hain
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await load(id);

  if (!cert) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-5xl">❌</p>
        <h1 className="mt-3 text-2xl font-bold">Certificate not found</h1>
        <p className="mt-2 text-slate-600">
          We could not find a certificate with the ID <span className="font-mono">{id}</span>. Please
          check the ID and try again.
        </p>
        <Link href="/" className="mt-5 inline-block text-indigo-600 hover:underline">
          Go to the home page
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          ✓ Verified by ScholarHub
        </p>
        <PrintButton />
      </div>

      <div className="rounded-2xl border-8 border-double border-indigo-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-600">ScholarHub</p>
        <h1 className="mt-3 text-4xl font-bold">Certificate of Completion</h1>
        <p className="mt-8 text-slate-500">This certifies that</p>
        <p className="mt-2 text-3xl font-semibold text-indigo-700">{cert.studentName}</p>
        <p className="mt-6 text-slate-500">has successfully completed the course</p>
        <p className="mt-2 text-2xl font-semibold">{cert.courseTitle}</p>
        {cert.instructorName && (
          <p className="mt-6 text-slate-600">Instructor: {cert.instructorName}</p>
        )}
        <p className="mt-1 text-slate-600">Completed on {formatDate(cert.completedAt)}</p>
        <p className="mt-8 font-mono text-sm text-slate-400">Certificate ID: {cert.certificateId}</p>
      </div>
    </main>
  );
}



