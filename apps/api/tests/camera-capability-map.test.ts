import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraModel, safeCamera } from '../src/modules/cameras/camera.model.js';
import { MongoCameraResourceValidator } from '../src/modules/cameras/camera-resource.js';

const organizationId = new Types.ObjectId();
const cameraId = new Types.ObjectId();
const validator = new MongoCameraResourceValidator();
const capability = (state: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') => ({
  state,
  source: 'ONVIF',
});

describe('hydrated camera capability maps', () => {
  afterEach(() => vi.restoreAllMocks());

  it('permits camera:view when a hydrated Map verifies live video support', async () => {
    vi.spyOn(CameraModel, 'findOne').mockResolvedValue({
      capabilities: new Map([['liveVideo', capability('SUPPORTED')]]),
    } as never);
    await expect(
      validator.validate(organizationId, cameraId, ['camera:view']),
    ).resolves.toBeUndefined();
  });

  it.each(['UNKNOWN', 'UNSUPPORTED'] as const)(
    'rejects camera:view when liveVideo is %s',
    async (state) => {
      vi.spyOn(CameraModel, 'findOne').mockResolvedValue({
        capabilities: new Map([['liveVideo', capability(state)]]),
      } as never);
      await expect(
        validator.validate(organizationId, cameraId, ['camera:view']),
      ).rejects.toMatchObject({ status: 422, code: 'CAMERA_CAPABILITY_UNAVAILABLE' });
    },
  );

  it('includes organization scope when locating the camera', async () => {
    const find = vi.spyOn(CameraModel, 'findOne').mockResolvedValue(null);
    await expect(
      validator.validate(organizationId, cameraId, ['camera:view']),
    ).rejects.toMatchObject({ status: 404, code: 'CAMERA_NOT_FOUND' });
    expect(find).toHaveBeenCalledWith({
      _id: cameraId,
      organizationId,
      deletedAt: { $exists: false },
    });
  });

  it('serializes Map capabilities without losing entries', () => {
    const now = new Date();
    const safe = safeCamera({
      _id: cameraId,
      organizationId,
      deviceId: new Types.ObjectId(),
      channelId: '1',
      displayName: 'Entrance',
      administratorNamed: false,
      profiles: [],
      status: 'ONLINE',
      mediaStatus: 'ONLINE',
      capabilities: new Map([
        ['liveVideo', capability('SUPPORTED')],
        ['audioInput', capability('UNKNOWN')],
      ]),
      createdAt: now,
      updatedAt: now,
    });
    expect(safe.capabilities).toMatchObject({
      liveVideo: { state: 'SUPPORTED' },
      audioInput: { state: 'UNKNOWN' },
    });
    expect(safe.audio.input).toBe('UNKNOWN');
  });
});
