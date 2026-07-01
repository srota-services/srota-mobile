/**
 * Audiobooks service
 * Handles audiobook API calls
 */

import { get, post, put, ApiError, API_V1_PATH } from './api';
import { store } from '@/store';
import { clampSyncPlaybackPosition } from '@/utils/playbackPosition';
import { normalizeResourceId } from '@/utils/resourceId';
import type { ImageAssetsMap } from '@/constants/imageVariants';

/**
 * Tag interface matching API response
 */
export interface Tag {
   id: string;
   name: string;
   type: string;
   createdAt: string;
   updatedAt: string;
}

/**
 * Genre interface matching API response
 */
export interface Genre {
   id: string;
   name: string;
   createdAt: string;
   updatedAt: string;
}

/**
 * Audiobook tag interface (used in Audiobook)
 */
export interface AudiobookTag {
   name: string;
   type: string;
}

/**
 * Subscription access info returned with a single audiobook
 */
export type SubscriptionTierCode = 'BASE' | 'STANDARD' | 'PREMIUM';

export interface SubscriptionAccess {
   canAccess: boolean;
   message?: string;
   requiredTier?: SubscriptionTierCode | number;
   userTier?: SubscriptionTierCode | number | null;
}

/**
 * Audiobook interface matching API response structure
 */
export interface Audiobook {
   id: string;
   title: string;
   author: string;
   narrator?: string; // Deprecated - use narrators array instead
   narrators: string[];
   description: string;
   duration: number;
   fileSize?: number;
   coverImage: string;
   imageAssets?: ImageAssetsMap;
   homeHeroCoverImage: string | null;
   contentCardCoverImage: string | null;
   chaptersHeroCoverImage: string | null;
   language: string;
   publisher?: string;
   publishDate?: string;
   isbn?: string;
   isActive: boolean;
   isPublic: boolean;
   createdAt: string;
   updatedAt: string;
   audiobookTags: AudiobookTag[];
   genre?: Genre; // Deprecated - use genres array instead
   genres: { name: string }[];
   meta: Record<string, string> | null;
   minSubscriptionTier?: number;
   subscriptionAccess?: SubscriptionAccess;
   /** Aggregate rating 0–5 from GET /audiobooks/{id} */
   rating?: number;
}

/**
 * Pagination information interface
 */
export interface PaginationInfo {
   currentPage: number;
   totalPages: number;
   totalItems: number;
   itemsPerPage: number;
   hasNextPage: boolean;
   hasPreviousPage: boolean;
}

/**
 * Audiobooks API response interface
 */
export interface AudiobooksResponse {
   success: boolean;
   data: Audiobook[];
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
   pagination: PaginationInfo;
}

/**
 * Tags API response interface
 */
export interface TagsResponse {
   success: boolean;
   data: Tag[];
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
}

/**
 * Genres API response interface
 */
export interface GenresResponse {
   success: boolean;
   data: Genre[];
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
}

/**
 * Chapter interface matching API response structure
 */
export interface Chapter {
   id: string;
   audiobookId: string;
   title: string;
   description: string;
   chapterNumber: number;
   duration: number;
   filePath: string;
   fileSize: number;
   coverImage: string;
   imageAssets?: ImageAssetsMap;
   chapterCardCoverImage: string | null;
   maximizedChapterCoverImage: string | null;
   minimizedChapterCoverImage: string | null;
   startPosition: number;
   endPosition: number;
   isActive: boolean;
   scheduledAt: string | null;
   createdAt: string;
   updatedAt: string;
   audiobook: {
      id: string;
      title: string;
      author: string;
   };
   bookmarks: unknown[];
   notes: unknown[];
   chapterProgress: unknown[];
   subscriptionAccess?: SubscriptionAccess;
}

/**
 * Chapters API response interface
 */
export interface ChaptersResponse {
   success: boolean;
   data: Chapter[];
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
   pagination: PaginationInfo;
}

/**
 * Single chapter API response from GET /chapters/:chapterId
 */
export interface ChapterResponse {
   success: boolean;
   data: Chapter;
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
}

/**
 * Chapter listening progress from GET /chapters/:chapterId/progress
 */
export interface ChapterProgress {
   id: string;
   userProfileId: string;
   chapterId: string;
   currentPosition: number;
   completed: boolean;
   lastListenedAt: string;
   createdAt: string;
   updatedAt: string;
}

export interface ChapterProgressResponse {
   success: boolean;
   data: ChapterProgress;
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
}

/**
 * Single audiobook API response interface
 */
export interface AudiobookResponse {
   success: boolean;
   data: Audiobook;
   message: string;
   statusCode: number;
   timestamp: string;
   path: string;
}

/**
 * Get tags
 * Calls GET {API_V1_PATH}/tags with Bearer token
 * @returns Promise with tags response
 * @throws ApiError if request fails
 */
export async function getTags(): Promise<TagsResponse> {
   try {
      const response = await get<TagsResponse>(`${API_V1_PATH}/tags`, true); // Use authentication
      return response.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get tags error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch tags: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get genres
 * Calls GET {API_V1_PATH}/genres with Bearer token
 * @returns Promise with genres response
 * @throws ApiError if request fails
 */
export async function getGenres(): Promise<GenresResponse> {
   try {
      const response = await get<GenresResponse>(`${API_V1_PATH}/genres`, true); // Use authentication
      return response.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get genres error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch genres: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get audiobooks by tag with pagination
 * Calls GET {API_V1_PATH}/audiobooks/tags/{tagName}?page={page} with Bearer token
 * @param tagName - Tag name (e.g., "New Releases", "Trending")
 * @param page - Page number (default: 1)
 * @returns Promise with audiobooks response containing data and pagination info
 * @throws ApiError if request fails
 */
export async function getAudiobooksByTag(
   tagName: string,
   page = 1
): Promise<AudiobooksResponse> {
   try {
      const encodedTagName = encodeURIComponent(tagName);
      const response = await get<AudiobooksResponse>(
         `${API_V1_PATH}/audiobooks/tags/${encodedTagName}?page=${page}`,
         true // Use authentication
      );
      return response.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get audiobooks by tag error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
         tagName,
         page,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch audiobooks by tag: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get audiobooks by genre with pagination
 * Calls GET {API_V1_PATH}/audiobooks/genre/{genreId}?page={page} with Bearer token
 * @param genreId - Genre ID
 * @param page - Page number (default: 1)
 * @returns Promise with audiobooks response containing data and pagination info
 * @throws ApiError if request fails
 */
export async function getAudiobooksByGenre(
   genreId: string,
   page = 1
): Promise<AudiobooksResponse> {
   try {
      const response = await get<AudiobooksResponse>(
         `${API_V1_PATH}/audiobooks/genre/${genreId}?page=${page}`,
         true // Use authentication
      );
      return response.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get audiobooks by genre error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
         genreId,
         page,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch audiobooks by genre: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get audiobooks with pagination (DEPRECATED - use getAudiobooksByTag or getAudiobooksByGenre)
 * Calls GET {API_V1_PATH}/audiobooks?page={page} with Bearer token
 * @param page - Page number (default: 1)
 * @returns Promise with audiobooks response containing data and pagination info
 * @throws ApiError if request fails
 * @deprecated Use getAudiobooksByTag or getAudiobooksByGenre instead
 */
export async function getAudiobooks(page = 1): Promise<AudiobooksResponse> {
   try {
      const response = await get<AudiobooksResponse>(
         `${API_V1_PATH}/audiobooks?page=${page}`,
         true // Use authentication
      );
      return response.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get audiobooks error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
         page,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch audiobooks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get audiobooks filtered by mood ID
 * GET /api/v1/audiobooks?moodIds={moodId}&page={page}
 */
export async function getAudiobooksByMood(
   moodId: string,
   page = 1
): Promise<AudiobooksResponse> {
   try {
      const response = await get<AudiobooksResponse>(
         `${API_V1_PATH}/audiobooks?moodIds=${encodeURIComponent(moodId)}&page=${page}`,
         true
      );
      return response.data;
   } catch (error) {
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch mood audiobooks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get chapters for an audiobook with pagination
 * Calls GET {API_V1_PATH}/audiobooks/:audiobookId/chapters?page={page} with Bearer token
 * @param audiobookId - Audiobook ID
 * @param page - Page number (default: 1)
 * @returns Promise with chapters response containing data and pagination info
 * @throws ApiError if request fails
 */
export async function getChapters(
   audiobookId: string,
   page = 1
): Promise<ChaptersResponse> {
   try {
      const response = await get<ChaptersResponse>(
         `${API_V1_PATH}/audiobooks/${audiobookId}/chapters?page=${page}`,
         true // Use authentication
      );
      return response.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get chapters error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
         audiobookId,
         page,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch chapters: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get single audiobook by ID
 * Calls GET {API_V1_PATH}/audiobooks/:audiobookId with Bearer token
 * @param audiobookId - Audiobook ID
 * @returns Promise with audiobook response
 * @throws ApiError if request fails
 */
/**
 * Search audiobooks by title, author, or description
 * GET /api/v1/audiobooks/search?q={query}
 */
export async function searchAudiobooks(query: string): Promise<AudiobooksResponse> {
   try {
      const encoded = encodeURIComponent(query.trim());
      const response = await get<AudiobooksResponse>(
         `${API_V1_PATH}/audiobooks/search?q=${encoded}`,
         true
      );
      return response.data;
   } catch (error) {
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to search audiobooks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

export async function getAudiobookById(
   audiobookId: string
): Promise<AudiobookResponse> {
   try {
      const response = await get<AudiobookResponse>(
         `${API_V1_PATH}/audiobooks/${audiobookId}`,
         true // Use authentication
      );
      return response.data;
   } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
         console.warn('[Audiobooks Service] Get audiobook by ID error', {
            error,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            audiobookId,
         });
      }
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch audiobook: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get a single chapter by ID (includes endPosition for playback bounds).
 * GET /api/v1/chapters/:chapterId
 */
export async function getChapterById(chapterId: string): Promise<Chapter> {
   try {
      const response = await get<ChapterResponse>(
         `${API_V1_PATH}/chapters/${chapterId}`,
         true
      );
      return response.data.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Get chapter by ID error', {
         error,
         chapterId,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch chapter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Get saved playback progress for a chapter.
 * GET /api/v1/chapters/:chapterId/progress
 */
export async function getChapterProgress(
   chapterId: string
): Promise<ChapterProgress | null> {
   const normalizedChapterId = normalizeResourceId(chapterId);
   if (!normalizedChapterId) {
      return null;
   }

   try {
      const response = await get<ChapterProgressResponse>(
         `${API_V1_PATH}/chapters/${normalizedChapterId}/progress`,
         true
      );
      return response.data.data;
   } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
         return null;
      }
      console.warn('[Audiobooks Service] Get chapter progress error', {
         error,
         chapterId,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to fetch chapter progress: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Update saved playback progress for a chapter.
 * PUT /api/v1/chapters/:chapterId/progress
 */
export interface UpdateChapterProgressRequest {
   currentPosition: number;
   completed?: boolean;
}

export async function updateChapterProgress(
   chapterId: string,
   body: UpdateChapterProgressRequest
): Promise<ChapterProgress> {
   try {
      const response = await put<ChapterProgressResponse>(
         `${API_V1_PATH}/chapters/${chapterId}/progress`,
         body,
         true
      );
      return response.data.data;
   } catch (error) {
      console.warn('[Audiobooks Service] Update chapter progress error', {
         error,
         chapterId,
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Failed to update chapter progress: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Playback session initialization request payload
 */
export interface InitializePlaybackSessionRequest {
   userId: string;
   audiobookId: string;
   chapterId: string;
}

/**
 * Initialize playback session with retry logic
 * Calls POST /api/v1/playback/session to track when a user starts playing a chapter
 * Retries up to 3 more times (total 4 attempts) if the API returns 404 on the first attempt
 * @param request - User ID, audiobook ID, and chapter ID
 * @returns Promise that resolves when session is initialized
 * @throws ApiError if initialization fails after all retries (but errors are caught and logged, not thrown)
 */
export async function initializePlaybackSession(
   request: InitializePlaybackSessionRequest
): Promise<void> {
   const maxRetries = 3; // Retry 3 more times after initial attempt (total 4 attempts)

   for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
         // Use authenticated request (useAuth=true) to include Bearer token
         await post<void>(
            `${API_V1_PATH}/playback/session`,
            {
               userId: request.userId,
               audiobookId: request.audiobookId,
               chapterId: request.chapterId,
            },
            true, // useAuth=true - includes Bearer token
            false // useAuthApi=false - uses main API (port 8082)
         );

         // Success - no need to retry
         if (attempt > 0) {
            console.log(`[Audiobooks Service] Playback session initialized successfully on attempt ${attempt + 1}`);
         }
         return;
      } catch (error) {
         // Check if error is 404 and we haven't exhausted retries
         const is404 = error instanceof ApiError && error.status === 404;
         const shouldRetry = is404 && attempt < maxRetries;

         if (shouldRetry) {
            // Wait a bit before retrying (exponential backoff: 500ms, 1000ms, 2000ms)
            const delayMs = 500 * Math.pow(2, attempt);
            console.log(
               `[Audiobooks Service] Playback session initialization returned 404, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue; // Retry
         } else {
            // Either not a 404, or we've exhausted retries
            if (is404 && attempt === maxRetries) {
               console.error(
                  `[Audiobooks Service] Playback session initialization failed after ${maxRetries + 1} attempts (all returned 404)`,
                  {
                     error,
                     errorType: error instanceof Error ? error.constructor.name : typeof error,
                     errorMessage: error instanceof Error ? error.message : String(error),
                     request,
                  }
               );
            } else {
               // Non-404 error or other issue
               console.error('[Audiobooks Service] Playback session initialization error', {
                  error,
                  errorType: error instanceof Error ? error.constructor.name : typeof error,
                  errorMessage: error instanceof Error ? error.message : String(error),
                  request,
                  attempt: attempt + 1,
               });
            }
            // Don't throw - allow playback to continue even if tracking fails
            return;
         }
      }
   }
}

/**
 * Playback sync request payload
 */
export interface SyncPlaybackRequest {
   audiobookId: string;
   action: 'play' | 'pause' | 'seek';
   position: number; // Position in seconds (integer)
   chapterId: string;
   /** Chapter duration — clamps seek sync so position stays before end */
   durationSeconds?: number;
}

/**
 * Sync playback state
 * Calls POST /api/v1/playback/sync to track playback position and state
 * @param request - Audiobook ID, action, position, and chapter ID
 * @returns Promise that resolves when sync is complete
 * @throws ApiError if sync fails (but errors are caught and logged, not thrown)
 */
export async function syncPlayback(
   request: SyncPlaybackRequest
): Promise<void> {
   try {
      const durationHint =
         request.durationSeconds != null && request.durationSeconds > 0
            ? request.durationSeconds
            : request.position;

      const syncedPosition = clampSyncPlaybackPosition(
         request.position,
         durationHint,
         request.action,
         store.getState().player.chapterEndPosition
      );

      // Use authenticated request (useAuth=true) to include Bearer token
      await post<void>(
         `${API_V1_PATH}/playback/sync`,
         {
            audiobookId: request.audiobookId,
            action: request.action,
            position: syncedPosition,
            chapterId: request.chapterId,
         },
         true, // useAuth=true - includes Bearer token
         false // useAuthApi=false - uses main API (port 8082)
      );
   } catch (error) {
      // Log error but don't block playback - this is a tracking API
      console.error('[Audiobooks Service] Playback sync error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
         request,
      });
      // Don't throw - allow playback to continue even if tracking fails
   }
}

