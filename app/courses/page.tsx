import Link from "next/link"
import { prisma } from "@/lib/prisma"

type Course = {
  id: string
  title: string
  description: string | null
  price: number
}

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    where: { published: true },
  })

  return (
    <div>
      <h1>Courses</h1>

      {courses.map((course: Course) => (
        <Link key={course.id} href={`/courses/${course.id}`}>
          <div style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            cursor: "pointer"
          }}>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
            <p>Price: ${course.price}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}