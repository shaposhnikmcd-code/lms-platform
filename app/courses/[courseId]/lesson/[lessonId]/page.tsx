import { prisma } from "@/lib/prisma"

export default async function LessonPage(props: any) {

  const params = await props.params
  const lessonId = params.lessonId

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId
    }
  })

  if (!lesson) {
    return <div>Lesson not found</div>
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>{lesson.title}</h1>

      {lesson.videoUrl && (
        <iframe
          width="800"
          height="450"
          src={lesson.videoUrl}
          allowFullScreen
        />
      )}

      <p>{lesson.content}</p>
    </div>
  )
}