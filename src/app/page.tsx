import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fullName, initials } from "@/lib/display";

export const dynamic = "force-dynamic";

export default async function Home() {
  const caregivers = await prisma.caregiver.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pflegekräfte</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Verwalte Profile, Dokumente und Referenzen-Exporte.
          </p>
        </div>
        <Link href="/caregivers/new" className="btn btn-primary">
          + Neue Pflegekraft
        </Link>
      </div>

      {caregivers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-base" style={{ color: "var(--muted)" }}>
            Noch keine Pflegekraft angelegt.
          </p>
          <Link href="/caregivers/new" className="btn btn-primary mt-4">
            Erste Pflegekraft anlegen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {caregivers.map((c) => (
            <Link key={c.id} href={`/caregivers/${c.id}`} className="card hover:shadow-md transition">
              <div className="flex items-center gap-4">
                {c.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/caregivers/${c.id}/photo/file`}
                    alt={c.firstName}
                    className="w-16 h-16 rounded-full object-cover"
                    style={{ border: "2px solid var(--brand-soft)" }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                  >
                    {initials(c.firstName, c.lastName)}
                  </div>
                )}
                <div>
                  <div className="font-semibold">
                    {fullName(c.firstName, c.lastName)}
                  </div>
                  {c.formerName && (
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      ehemalig {c.formerName}
                    </div>
                  )}
                  <div className="text-xs mt-1">
                    <span className="badge">{c._count.documents} Dokumente</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
