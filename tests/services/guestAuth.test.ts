import { createGuestSession } from '@/services/auth';
import { post } from '@/services/api';
import { fetchAndStoreDeviceDetails } from '@/services/device';

jest.mock('@react-native-google-signin/google-signin', () => ({
   GoogleSignin: {
      configure: jest.fn(),
      signOut: jest.fn(() => Promise.resolve()),
      revokeAccess: jest.fn(() => Promise.resolve()),
   },
}));

jest.mock('@/services/device', () => ({
   fetchAndStoreDeviceDetails: jest.fn(),
}));

jest.mock('@/services/api', () => ({
   post: jest.fn(),
   ApiError: class ApiError extends Error {
      status: number;
      constructor(message: string, status: number) {
         super(message);
         this.status = status;
      }
   },
}));

const mockedPost = post as jest.MockedFunction<typeof post>;
const mockedFetchAndStoreDeviceDetails =
   fetchAndStoreDeviceDetails as jest.MockedFunction<typeof fetchAndStoreDeviceDetails>;

describe('createGuestSession', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockedFetchAndStoreDeviceDetails.mockResolvedValue({
         deviceId: 'device-123',
         deviceName: 'Test Phone',
         platform: 'ios',
      });
   });

   it('sends mobile client type and device payload to guest endpoint', async () => {
      mockedPost.mockResolvedValue({
         data: {
            message: 'Guest session created successfully',
            accessToken: 'guest-access-token',
            refreshToken: 'guest-refresh-token',
            user: {
               id: 'guest-user-1',
               email: 'guest@example.com',
               role: 'GUEST',
               emailVerified: true,
            },
         },
         status: 200,
         statusText: 'OK',
      });

      const result = await createGuestSession();

      expect(mockedFetchAndStoreDeviceDetails).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith(
         '/auth/guest',
         {
            clientType: 'mobile',
            device: {
               deviceId: 'device-123',
               deviceName: 'Test Phone',
               platform: 'ios',
            },
         },
         false,
         true
      );
      expect(result.accessToken).toBe('guest-access-token');
      expect(result.user.role).toBe('GUEST');
   });
});
