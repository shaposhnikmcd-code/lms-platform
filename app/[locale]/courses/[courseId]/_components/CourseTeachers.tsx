interface Teacher {
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface CourseTeachersProps {
  teachers: Teacher[];
}

export default function CourseTeachers({ teachers }: CourseTeachersProps) {
  return (
    <section className="bg-[#1C3A2E] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">
            {"Експерти"}
          </span>
          <h2 className="text-3xl font-bold text-white mt-2">{"Викладачі курсу"}</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {teachers.map((ct) => (
            <div key={ct.user.id} className="text-center">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white border-2 border-[#D4A017] overflow-hidden">
                {ct.user.image ? (
                  <img
                    src={ct.user.image}
                    alt={ct.user.name || ""}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  (ct.user.name || "T")[0].toUpperCase()
                )}
              </div>
              <p className="text-white font-semibold">{ct.user.name}</p>
              <p className="text-white/60 text-sm">{"Викладач"}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}