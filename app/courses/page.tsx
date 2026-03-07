import Link from "next/link"
import { prisma } from "@/lib/prisma"

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    where: { published: true },
  })

  return (
    <div>
      <h1>Courses</h1>

      {courses.map((course) => (
        <Link key={course.id} href={`/courses/${course.id}`}>
          <div
            style={{
              border: "1px solid #ccc",
              padding: 10,
              marginBottom: 10,
              cursor: "pointer",
            }}
          >
            <h3>{course.title}</h3>
            <p>{course.description}</p>
            <p>Price: ${course.price}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}