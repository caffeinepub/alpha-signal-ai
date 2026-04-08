// Stub useActor hook — returns a null actor since the backend interface is minimal.
// All live data (Binance, Gemini) routes through direct fetch calls.

export interface ActorLike {
  getCallerUserRole: () => Promise<string>;
  getVideos: () => Promise<
    Array<{
      id: bigint;
      title: string;
      description: string;
      videoUrl: string;
      thumbnailUrl: string;
      difficulty: string;
      uploaded_at: bigint;
    }>
  >;
  addVideo: (
    title: string,
    description: string,
    videoUrl: string,
    thumbnailUrl: string,
    difficulty: unknown,
  ) => Promise<void>;
  deleteVideo: (id: bigint) => Promise<void>;
  [key: string]: unknown;
}

export function useActor(): { actor: ActorLike | null; isFetching: boolean } {
  return { actor: null, isFetching: false };
}
