import { ic, lc } from "./constants";
import { toSlug } from "./constants";

interface MetaNew {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
}

interface Props {
  meta: MetaNew;
  onChange: (meta: MetaNew) => void;
}

export default function MetaPanel({ meta, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className={lc}>Заголовок *</label>
        <input
          value={meta.title}
          onChange={e => onChange({ ...meta, title: e.target.value, slug: toSlug(e.target.value) })}
          placeholder="Назва новини"
          className={ic}
        />
      </div>
      <div>
        <label className={lc}>Slug (URL) *</label>
        <input
          value={meta.slug}
          onChange={e => onChange({ ...meta, slug: e.target.value })}
          placeholder="nazva-novyny"
          className={ic}
        />
        <p className="text-xs text-gray-400 mt-0.5">/news/{meta.slug || "slug"}</p>
      </div>
      <div>
        <label className={lc}>Короткий опис</label>
        <textarea
          value={meta.excerpt}
          onChange={e => onChange({ ...meta, excerpt: e.target.value })}
          placeholder="Короткий опис новини..."
          rows={3}
          className={ic + " resize-none"}
        />
      </div>
      <div>
        <label className={lc}>Категорія</label>
        <select
          value={meta.category}
          onChange={e => onChange({ ...meta, category: e.target.value })}
          className={ic}
        >
          <option value="NEWS">Новини</option>
          <option value="ANNOUNCEMENT">Оголошення</option>
          <option value="ARTICLE">Стаття</option>
        </select>
      </div>
    </div>
  );
}