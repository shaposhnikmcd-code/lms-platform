'use client';

interface VideoPlayerProps {
  videoUrl: string | null;
  videoProvider: string;
  videoId: string | null;
}

export default function VideoPlayer({ videoUrl, videoProvider, videoId }: VideoPlayerProps) {
  if (videoProvider === 'YOUTUBE' && videoId) {
    return (
      <iframe
        className="w-full aspect-video rounded-xl"
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (videoProvider === 'SENDPULSE' && videoUrl) {
    return (
      <iframe
        className="w-full aspect-video rounded-xl"
        src={videoUrl}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }

  if (videoUrl) {
    return (
      <video
        className="w-full aspect-video rounded-xl bg-black"
        controls
        controlsList="nodownload"
        src={videoUrl}
      />
    );
  }

  return (
    <div className="w-full aspect-video flex items-center justify-center bg-gray-900 rounded-xl">
      <p className="text-gray-400">{"Відео недоступне"}</p>
    </div>
  );
}