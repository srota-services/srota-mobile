import { store } from '@/store';
import { getMasterPlaylist, getPlaylist } from '@/services/streaming';
import { writePlaybackPlaylistFile } from '@/utils/playlistCacheFile';
import {
   fetchChapterPlaybackSource,
   resolveChapterPlaybackSource,
} from '@/utils/chapterStreamUrl';

jest.mock('react-native', () => ({
   Platform: { OS: 'android' },
}));

jest.mock('@/store', () => ({
   store: {
      getState: jest.fn(),
   },
}));

jest.mock('@/services/streaming', () => ({
   getMasterPlaylist: jest.fn(),
   getPlaylist: jest.fn(),
}));

jest.mock('@/utils/playlistCacheFile', () => ({
   writePlaybackPlaylistFile: jest.fn(),
}));

const MASTER_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=64000,CODECS="mp4a.40.2"
bit_transcode/chapter-1/64k/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"
bit_transcode/chapter-1/128k/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=256000,CODECS="mp4a.40.2"
bit_transcode/chapter-1/256k/playlist.m3u8`;

const VARIANT_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MAP:URI="bit_transcode/chapter-1/256k/init.mp4"
#EXTINF:4.0,
segment_000.m4s
#EXT-X-ENDLIST`;

describe('chapterStreamUrl', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      (getMasterPlaylist as jest.Mock).mockResolvedValue(MASTER_PLAYLIST);
      (getPlaylist as jest.Mock).mockResolvedValue(VARIANT_PLAYLIST);
      (writePlaybackPlaylistFile as jest.Mock).mockResolvedValue(
         'file:///cache/playback-chapter-1-256-user-1.m3u8'
      );
      (store.getState as jest.Mock).mockReturnValue({
         streaming: { playlistsByChapterId: {} },
      });
   });

   it('fetches the subscription-preferred bitrate variant', async () => {
      const source = await fetchChapterPlaybackSource('chapter-1', 'user-1', {
         preferredBitrateKbps: 256,
      });

      expect(getPlaylist).toHaveBeenCalledWith('chapter-1', '256', 'user-1');
      expect(source.playlistData.selectedBitrate).toBe(256);
   });

   it('uses forceBitrateKbps for playback retry attempts', async () => {
      await fetchChapterPlaybackSource('chapter-1', 'user-1', {
         forceBitrateKbps: 128,
      });

      expect(getPlaylist).toHaveBeenCalledWith('chapter-1', '128', 'user-1');
   });

   it('bypasses cached playlist when requested bitrate differs', async () => {
      (store.getState as jest.Mock).mockReturnValue({
         streaming: {
            playlistsByChapterId: {
               'chapter-1': {
                  masterPlaylist: {
                     streams: [
                        {
                           bandwidth: 128000,
                           playlistPath: 'bit_transcode/chapter-1/128k/playlist.m3u8',
                        },
                     ],
                  },
                  selectedBitrate: 128,
                  playlist: { segments: [{ duration: 4, path: 'segment_000.m4s', segmentId: 'segment_000' }], isEndList: true },
               },
            },
         },
      });

      await resolveChapterPlaybackSource('chapter-1', 'user-1', {
         forceBitrateKbps: 256,
      });

      expect(getMasterPlaylist).toHaveBeenCalled();
      expect(getPlaylist).toHaveBeenCalledWith('chapter-1', '256', 'user-1');
   });

   it('reuses cached playlist when bitrate matches', async () => {
      (store.getState as jest.Mock).mockReturnValue({
         streaming: {
            playlistsByChapterId: {
               'chapter-1': {
                  masterPlaylist: {
                     streams: [
                        {
                           bandwidth: 256000,
                           playlistPath: 'bit_transcode/chapter-1/256k/playlist.m3u8',
                        },
                     ],
                  },
                  selectedBitrate: 256,
                  playlist: { segments: [{ duration: 4, path: 'segment_000.m4s', segmentId: 'segment_000' }], isEndList: true },
               },
            },
         },
      });

      await resolveChapterPlaybackSource('chapter-1', 'user-1', {
         forceBitrateKbps: 256,
      });

      expect(getMasterPlaylist).not.toHaveBeenCalled();
      expect(getPlaylist).toHaveBeenCalledWith('chapter-1', '256', 'user-1');
   });
});
