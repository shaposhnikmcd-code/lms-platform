import prisma from "@/lib/prisma";
import { consultationsContent } from "@/app/[locale]/consultations/_content/uk";
import SpecialistsView from "./_components/SpecialistsView";

export const revalidate = 30;

export default async function AdminSpecialists() {
  const overrides = await prisma.specialistOverride.findMany();
  const overridesBySlug = new Map(overrides.map((o) => [o.slug, o]));

  const rows = consultationsContent.specialists.map((s) => ({
    slug: s.slug,
    name: s.name,
    role: s.role,
    image: s.image ?? null,
    defaults: {
      price: s.price,
      duration: s.duration,
      btnLabel: consultationsContent.btnBook,
      btnUrl: s.calendlyUrl,
    },
    override: overridesBySlug.get(s.slug) ?? null,
  }));

  return <SpecialistsView rows={rows} />;
}
