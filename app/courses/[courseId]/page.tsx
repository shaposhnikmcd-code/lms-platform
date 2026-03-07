import { prisma } from "@/lib/prisma"

export default async function CoursePage({ params }: any) {

  const courseId = params.courseId

  const course = await prisma.course.findUnique({
    where: {
      id: courseId
    }
  })

  if (!course) {
    return <div>Course not found</div>
  }

  return (
    <div>
      <h1>{course.title}</h1>
      <p>{course.description}</p>
      <p>Price: ${course.price}</p>
    </div>
  )
}