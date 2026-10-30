import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import type { AuditService } from '../alerts/audit.service.js';
import {
  CameraAssignmentModel,
  cameraPermissions,
} from '../assignments/camera-assignment.model.js';
import { paginationSchema, passwordSchema, usernameSchema } from '../auth/auth.schemas.js';
import type { AuthService } from '../auth/auth.service.js';
import type { PasswordService } from '../auth/password.service.js';
import type { CameraResourceValidator } from '../cameras/camera-resource.js';
import { safeUser, UserModel, userStatuses } from './user.model.js';

const clientCreate = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().min(2).max(120),
    email: z.string().email().optional(),
    temporaryPassword: passwordSchema,
  })
  .strict();
const clientUpdate = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    email: z.string().email().nullable().optional(),
  })
  .strict();
const statusUpdate = z.object({ status: z.enum(userStatuses) }).strict();
const resetPassword = z.object({ temporaryPassword: passwordSchema.optional() }).strict();
const assignmentBody = z
  .object({ cameraId: z.string(), permissions: z.array(z.enum(cameraPermissions)).min(1) })
  .strict();
const permissionsBody = z
  .object({ permissions: z.array(z.enum(cameraPermissions)).min(1) })
  .strict();
const generatedPassword = () => `BmC!${randomBytes(12).toString('base64url')}9aA`;

export const createAdminRouter = (
  passwords: PasswordService,
  auth: AuthService,
  audit: AuditService,
  cameras: CameraResourceValidator,
): Router => {
  const router = Router();
  router.use(requireRole('INSTALLER_ADMIN'), requirePasswordChanged);
  const clientFilter = (req: Request, id?: unknown) => ({
    ...(id ? { _id: id } : {}),
    organizationId: req.authUser!.organizationId,
    role: 'CLIENT' as const,
  });
  router.post(
    '/clients',
    asyncHandler(async (req, res) => {
      const body = clientCreate.parse(req.body);
      const user = await UserModel.create({
        organizationId: req.authUser!.organizationId,
        username: body.username,
        displayName: body.displayName,
        email: body.email,
        passwordHash: await passwords.hash(body.temporaryPassword),
        role: 'CLIENT',
        status: 'ACTIVE',
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        createdBy: req.authUser!._id,
      });
      await audit.record({
        actorId: req.authUser!._id,
        action: 'CLIENT_CREATED',
        targetType: 'User',
        targetId: user.id,
        organizationId: user.organizationId,
      });
      return sendSuccess(res, 201, { user: safeUser(user) });
    }),
  );
  router.get(
    '/clients',
    asyncHandler(async (req, res) => {
      const { page, limit } = paginationSchema.parse(req.query);
      const filter = clientFilter(req);
      const [users, total] = await Promise.all([
        UserModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        UserModel.countDocuments(filter),
      ]);
      return sendSuccess(res, 200, {
        items: users.map(safeUser),
        pagination: { page, limit, total },
      });
    }),
  );
  router.get(
    '/clients/:clientId',
    asyncHandler(async (req, res) => {
      const user = await UserModel.findOne(
        clientFilter(req, objectId(routeParam(req, 'clientId'), 'clientId')),
      );
      if (!user) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
      return sendSuccess(res, 200, { user: safeUser(user) });
    }),
  );
  router.patch(
    '/clients/:clientId',
    asyncHandler(async (req, res) => {
      const body = clientUpdate.parse(req.body);
      const update: Record<string, unknown> = {};
      if (body.displayName !== undefined) update.displayName = body.displayName;
      if (body.email !== undefined) update.email = body.email ?? undefined;
      const user = await UserModel.findOneAndUpdate(
        clientFilter(req, objectId(routeParam(req, 'clientId'), 'clientId')),
        { $set: update },
        { new: true, runValidators: true },
      );
      if (!user) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
      return sendSuccess(res, 200, { user: safeUser(user) });
    }),
  );
  router.patch(
    '/clients/:clientId/status',
    asyncHandler(async (req, res) => {
      const body = statusUpdate.parse(req.body);
      const user = await UserModel.findOneAndUpdate(
        clientFilter(req, objectId(routeParam(req, 'clientId'), 'clientId')),
        { status: body.status },
        { new: true, runValidators: true },
      );
      if (!user) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
      if (body.status !== 'ACTIVE') await auth.revokeAll(user._id);
      await audit.record({
        actorId: req.authUser!._id,
        action: 'CLIENT_STATUS_CHANGED',
        targetType: 'User',
        targetId: user.id,
        organizationId: user.organizationId,
        metadata: { status: body.status },
      });
      return sendSuccess(res, 200, { user: safeUser(user) });
    }),
  );
  router.post(
    '/clients/:clientId/reset-password',
    asyncHandler(async (req, res) => {
      const body = resetPassword.parse(req.body);
      const temporaryPassword = body.temporaryPassword ?? generatedPassword();
      const user = await UserModel.findOne(
        clientFilter(req, objectId(routeParam(req, 'clientId'), 'clientId')),
      ).select('+passwordHash');
      if (!user) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
      user.passwordHash = await passwords.hash(temporaryPassword);
      user.mustChangePassword = true;
      user.passwordChangedAt = new Date();
      await user.save();
      await auth.revokeAll(user._id);
      await audit.record({
        actorId: req.authUser!._id,
        action: 'PASSWORD_RESET',
        targetType: 'User',
        targetId: user.id,
        organizationId: user.organizationId,
      });
      return sendSuccess(res, 200, { user: safeUser(user), temporaryPassword });
    }),
  );
  router.post(
    '/clients/:clientId/cameras',
    asyncHandler(async (req, res) => {
      const body = assignmentBody.parse(req.body);
      const clientId = objectId(routeParam(req, 'clientId'), 'clientId');
      const cameraId = objectId(body.cameraId, 'cameraId');
      const client = await UserModel.exists(clientFilter(req, clientId));
      if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
      const organizationId = req.authUser!.organizationId;
      if (!organizationId)
        throw new ApiError(403, 'ORGANIZATION_REQUIRED', 'Organization context is required');
      await cameras.validate(organizationId, cameraId, body.permissions);
      const assignment = await CameraAssignmentModel.create({
        organizationId,
        clientId,
        cameraId,
        permissions: body.permissions,
        assignedBy: req.authUser!._id,
      });
      await audit.record({
        actorId: req.authUser!._id,
        action: 'CAMERA_ASSIGNMENT_CREATED',
        targetType: 'CameraAssignment',
        targetId: assignment.id,
        organizationId,
      });
      return sendSuccess(res, 201, { assignment });
    }),
  );
  router.get(
    '/clients/:clientId/cameras',
    asyncHandler(async (req, res) => {
      const clientId = objectId(routeParam(req, 'clientId'), 'clientId');
      if (!(await UserModel.exists(clientFilter(req, clientId))))
        throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');
      const items = await CameraAssignmentModel.find({
        organizationId: req.authUser!.organizationId,
        clientId,
      }).lean();
      return sendSuccess(res, 200, { items });
    }),
  );
  router.patch(
    '/clients/:clientId/cameras/:cameraId',
    asyncHandler(async (req, res) => {
      const body = permissionsBody.parse(req.body);
      const clientId = objectId(routeParam(req, 'clientId'), 'clientId');
      const cameraId = objectId(routeParam(req, 'cameraId'), 'cameraId');
      const organizationId = req.authUser!.organizationId;
      if (!organizationId)
        throw new ApiError(403, 'ORGANIZATION_REQUIRED', 'Organization context is required');
      await cameras.validate(organizationId, cameraId, body.permissions);
      const item = await CameraAssignmentModel.findOneAndUpdate(
        { organizationId, clientId, cameraId },
        { permissions: body.permissions, assignedBy: req.authUser!._id },
        { new: true, runValidators: true },
      );
      if (!item) throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND', 'Camera assignment not found');
      return sendSuccess(res, 200, { assignment: item });
    }),
  );
  router.delete(
    '/clients/:clientId/cameras/:cameraId',
    asyncHandler(async (req, res) => {
      const item = await CameraAssignmentModel.findOneAndDelete({
        organizationId: req.authUser!.organizationId,
        clientId: objectId(routeParam(req, 'clientId'), 'clientId'),
        cameraId: objectId(routeParam(req, 'cameraId'), 'cameraId'),
      });
      if (!item) throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND', 'Camera assignment not found');
      await audit.record({
        actorId: req.authUser!._id,
        action: 'CAMERA_ASSIGNMENT_REMOVED',
        targetType: 'CameraAssignment',
        targetId: item.id,
        organizationId: req.authUser!.organizationId,
      });
      return sendSuccess(res, 200, { message: 'Assignment removed' });
    }),
  );
  return router;
};
