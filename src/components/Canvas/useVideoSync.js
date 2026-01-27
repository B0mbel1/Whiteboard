import { useEffect, useRef } from 'react';

export const useVideoSync = ({ socket, whiteboardId, videos, setVideos }) => {
  const syncIntervalRef = useRef(null);

  useEffect(() => {
    if (!socket || !whiteboardId || videos.length === 0) return;

    // Periodyczna synchronizacja co 5 sekund
    syncIntervalRef.current = setInterval(() => {
      videos.forEach(video => {
        socket.emit("video-sync", {
          whiteboardId,
          videoId: video.id
        });
      });
    }, 5000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [socket, whiteboardId, videos]);

  return null;
};