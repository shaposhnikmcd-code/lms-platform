"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// Білдер превʼю переїхав у таб всередині /dashboard/admin/news/[id]/edit.
// Це сторінка-перенаправлення для backward-compat зі старими лінками/закладками.
export default function PreviewBuilderRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id as string;

  useEffect(() => {
    if (id) router.replace(`/dashboard/admin/news/${id}/edit`);
  }, [id, router]);

  return null;
}
