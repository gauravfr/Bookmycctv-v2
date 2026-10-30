import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { requirePasswordChanged, requireRole } from '../src/middleware/auth.js';
import { CameraAssignmentModel } from '../src/modules/assignments/camera-assignment.model.js';
import { CameraPermissionService } from '../src/modules/assignments/permission.service.js';
import { safeUser, UserModel } from '../src/modules/users/user.model.js';

const fakeRequest = (
  role: 'PLATFORM_ADMIN' | 'INSTALLER_ADMIN' | 'CLIENT',
  mustChangePassword = false,
) => ({ authUser: { role, mustChangePassword } });

describe('authorization boundaries', () => {
  it('allows the required role', () => {
    const next = vi.fn();
    requireRole('INSTALLER_ADMIN')(fakeRequest('INSTALLER_ADMIN') as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });
  it('rejects another role', () => {
    const next = vi.fn();
    requireRole('INSTALLER_ADMIN')(fakeRequest('CLIENT') as never, {} as never, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
  it('blocks privileged work until a temporary password is changed', () => {
    const next = vi.fn();
    requirePasswordChanged(fakeRequest('CLIENT', true) as never, {} as never, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  });
  it('allows work after password change', () => {
    const next = vi.fn();
    requirePasswordChanged(fakeRequest('CLIENT', false) as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });
  it('rejects access to an unassigned camera', async () => {
    vi.spyOn(CameraAssignmentModel, 'exists').mockResolvedValueOnce(null);
    await expect(
      new CameraPermissionService().require(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        'camera:view',
      ),
    ).rejects.toMatchObject({ code: 'CAMERA_ACCESS_DENIED' });
  });
  it('allows only an explicitly assigned camera permission', async () => {
    vi.spyOn(CameraAssignmentModel, 'exists').mockResolvedValueOnce({
      _id: new Types.ObjectId(),
    } as never);
    await expect(
      new CameraPermissionService().require(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        'camera:ptz',
      ),
    ).resolves.toBeUndefined();
  });
  it('never exposes password hashes in safe profiles', () => {
    const user = new UserModel({
      organizationId: new Types.ObjectId(),
      username: 'client.one',
      displayName: 'Client One',
      passwordHash: 'secret-hash',
      role: 'CLIENT',
      status: 'ACTIVE',
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      createdBy: new Types.ObjectId(),
    });
    expect(safeUser(user)).not.toHaveProperty('passwordHash');
  });
});
