interface Props {
  published?: boolean;
  saving: boolean;
  uploading: boolean;
  onSave: (published: boolean) => void;
  onTogglePublished?: (val: boolean) => void;
  isEdit?: boolean;
}

export default function PublishPanel({ published, saving, uploading, onSave, onTogglePublished, isEdit = false }: Props) {
  return (
    <div className="space-y-2">
      {uploading && (
        <p className="text-xs text-gray-400 animate-pulse text-center">Завантаження...</p>
      )}
      {isEdit && onTogglePublished && (
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={e => onTogglePublished(e.target.checked)}
            className="w-4 h-4 accent-[#1C3A2E]"
          />
          <label htmlFor="published" className="text-sm text-gray-600">Опубліковано</label>
        </div>
      )}
      {isEdit ? (
        <>
          <button
            onClick={() => onSave(published ?? false)}
            disabled={saving}
            className="w-full py-2.5 bg-[#1C3A2E] text-white text-sm font-medium rounded-xl hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50"
          >
            {saving ? "Збереження..." : "Зберегти зміни"}
          </button>
          <button
            onClick={() => onSave(false)}
            disabled={saving}
            className="w-full py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Зберегти як чернетку
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onSave(true)}
            disabled={saving}
            className="w-full py-2.5 bg-[#1C3A2E] text-white text-sm font-medium rounded-xl hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50"
          >
            {saving ? "Збереження..." : "Опублікувати"}
          </button>
          <button
            onClick={() => onSave(false)}
            disabled={saving}
            className="w-full py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Зберегти чернетку
          </button>
        </>
      )}
    </div>
  );
}